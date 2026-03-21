import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { query, queryOne } from '../../../lib/db'

export const dynamic = 'force-dynamic'

// ---- JSON-RPC types ----

interface JsonRpcRequest {
  jsonrpc?: string
  id?: string | number | null
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: string | number | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

function jsonrpc(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result }
}

function jsonrpcError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, data } }
}

// ---- Method handlers ----

async function listEndeavors(params: Record<string, unknown>, userId: string) {
  let sql = 'SELECT id, title, description, status, node_type, context_id, created_at, updated_at, metadata FROM endeavors WHERE 1=1'
  const sqlParams: any[] = []
  let idx = 1

  if (params.context_id) {
    sql += ` AND context_id = $${idx++}`
    sqlParams.push(params.context_id)
  }
  if (params.node_type) {
    sql += ` AND node_type = $${idx++}`
    sqlParams.push(params.node_type)
  }

  sql += ' ORDER BY created_at DESC'
  const limit = typeof params.limit === 'number' ? params.limit : 100
  sql += ` LIMIT $${idx++}`
  sqlParams.push(limit)

  const data = await query(sql, sqlParams)
  return { endeavors: data }
}

async function getEndeavor(params: Record<string, unknown>, userId: string) {
  const id = params.id as string
  if (!id) throw new MethodError(-32602, 'Missing required param: id')

  const endeavor = await queryOne(
    'SELECT id, title, description, status, node_type, context_id, created_at, updated_at, metadata FROM endeavors WHERE id = $1',
    [id]
  )

  if (!endeavor) throw new MethodError(-32602, 'Endeavor not found')

  const childEdges = await query(
    'SELECT to_endeavor_id FROM edges WHERE from_endeavor_id = $1 AND relationship = $2',
    [id, 'contains']
  )
  const childIds = childEdges.map((e: any) => e.to_endeavor_id)

  let children: any[] = []
  if (childIds.length > 0) {
    children = await query(
      'SELECT id, title, description, status, node_type, context_id, created_at, updated_at, metadata FROM endeavors WHERE id = ANY($1) ORDER BY created_at DESC',
      [childIds]
    )
  }

  const parentEdge = await queryOne(
    'SELECT from_endeavor_id FROM edges WHERE to_endeavor_id = $1 AND relationship = $2 LIMIT 1',
    [id, 'contains']
  )

  return {
    endeavor: {
      ...endeavor,
      parent_id: parentEdge?.from_endeavor_id ?? null,
    },
    children,
  }
}

async function getTree(params: Record<string, unknown>, userId: string) {
  const contextId = params.context_id as string
  if (!contextId) throw new MethodError(-32602, 'Missing required param: context_id')

  const endeavors = await query(
    'SELECT id, title, description, status, node_type, context_id, created_at, updated_at, metadata FROM endeavors WHERE context_id = $1 ORDER BY created_at DESC',
    [contextId]
  )

  const nodeIds = endeavors.map((e: any) => e.id)

  let edges: any[] = []
  if (nodeIds.length > 0) {
    edges = await query(
      'SELECT from_endeavor_id, to_endeavor_id, relationship FROM edges WHERE from_endeavor_id = ANY($1) AND relationship = $2',
      [nodeIds, 'contains']
    )
  }

  const parentMap: Record<string, string> = {}
  for (const edge of edges) {
    parentMap[edge.to_endeavor_id] = edge.from_endeavor_id
  }

  const nodes = endeavors.map((e: any) => ({
    ...e,
    parent_id: parentMap[e.id] ?? null,
  }))

  const nodeMap: Record<string, any> = {}
  for (const node of nodes) {
    nodeMap[node.id] = { ...node, children: [] }
  }
  const roots: any[] = []
  for (const node of nodes) {
    if (node.parent_id && nodeMap[node.parent_id]) {
      nodeMap[node.parent_id].children.push(nodeMap[node.id])
    } else {
      roots.push(nodeMap[node.id])
    }
  }

  return { tree: roots, flat_nodes: nodes, edges }
}

async function searchEndeavors(params: Record<string, unknown>, userId: string) {
  const q = params.query as string
  if (!q) throw new MethodError(-32602, 'Missing required param: query')

  const limit = typeof params.limit === 'number' ? params.limit : 20
  const sqlParams: any[] = [`%${q}%`, `%${q}%`]
  let sql = 'SELECT id, title, description, status, node_type, context_id, created_at, updated_at, metadata FROM endeavors WHERE (title ILIKE $1 OR description ILIKE $2)'
  let idx = 3

  if (params.context_id) {
    sql += ` AND context_id = $${idx++}`
    sqlParams.push(params.context_id)
  }

  sql += ` ORDER BY created_at DESC LIMIT $${idx++}`
  sqlParams.push(limit)

  const data = await query(sql, sqlParams)
  return { endeavors: data, query: q }
}

class MethodError extends Error {
  code: number
  data?: unknown
  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.code = code
    this.data = data
  }
}

const METHODS: Record<
  string,
  (params: Record<string, unknown>, userId: string) => Promise<unknown>
> = {
  list_endeavors: listEndeavors,
  get_endeavor: getEndeavor,
  get_tree: getTree,
  search_endeavors: searchEndeavors,
}

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  let body: JsonRpcRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      jsonrpcError(null, -32700, 'Parse error: invalid JSON'),
      { status: 400 }
    )
  }

  const id = body.id ?? null
  const method = body.method

  if (!method || typeof method !== 'string') {
    return NextResponse.json(
      jsonrpcError(id, -32600, 'Invalid request: missing method'),
      { status: 400 }
    )
  }

  const handler = METHODS[method]
  if (!handler) {
    return NextResponse.json(
      jsonrpcError(id, -32601, `Method not found: ${method}`, {
        available_methods: Object.keys(METHODS),
      }),
      { status: 400 }
    )
  }

  try {
    const result = await handler(body.params ?? {}, user.id)
    return NextResponse.json(jsonrpc(id, result))
  } catch (err) {
    if (err instanceof MethodError) {
      return NextResponse.json(
        jsonrpcError(id, err.code, err.message, err.data),
        { status: 400 }
      )
    }
    console.error(`MCP method "${method}" error:`, err)
    return NextResponse.json(
      jsonrpcError(id, -32603, 'Internal error'),
      { status: 500 }
    )
  }
})
