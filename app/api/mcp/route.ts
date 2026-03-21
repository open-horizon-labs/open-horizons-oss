import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'

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

async function listEndeavors(
  params: Record<string, unknown>,
  userId: string,
  supabase: any
) {
  let qb = supabase
    .from('endeavors')
    .select('id, title, description, status, node_type, context_id, created_at, updated_at, metadata')
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (params.context_id) {
    qb = qb.eq('context_id', params.context_id as string)
  }
  if (params.node_type) {
    qb = qb.eq('node_type', params.node_type as string)
  }
  if (typeof params.limit === 'number') {
    qb = qb.limit(params.limit)
  } else {
    qb = qb.limit(100)
  }

  const { data, error } = await qb
  if (error) throw new Error(`Database error: ${error.message}`)
  return { endeavors: data ?? [] }
}

async function getEndeavor(
  params: Record<string, unknown>,
  userId: string,
  supabase: any
) {
  const id = params.id as string
  if (!id) throw new MethodError(-32602, 'Missing required param: id')

  const { data: endeavor, error } = await supabase
    .from('endeavors')
    .select('id, title, description, status, node_type, context_id, created_at, updated_at, metadata')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') throw new MethodError(-32602, 'Endeavor not found')
    throw new Error(`Database error: ${error.message}`)
  }

  // Get children via edges
  const { data: childEdges } = await supabase
    .from('edges')
    .select('to_endeavor_id')
    .eq('from_endeavor_id', id)
    .eq('relationship', 'contains')

  const childIds = (childEdges ?? []).map((e: any) => e.to_endeavor_id)

  let children: any[] = []
  if (childIds.length > 0) {
    const { data: childData } = await supabase
      .from('endeavors')
      .select('id, title, description, status, node_type, context_id, created_at, updated_at, metadata')
      .in('id', childIds)
      .is('archived_at', null)
      .order('created_at', { ascending: false })
    children = childData ?? []
  }

  // Get parent via edges
  const { data: parentEdge } = await supabase
    .from('edges')
    .select('from_endeavor_id')
    .eq('to_endeavor_id', id)
    .eq('relationship', 'contains')
    .limit(1)
    .maybeSingle()

  return {
    endeavor: {
      ...endeavor,
      parent_id: parentEdge?.from_endeavor_id ?? null,
    },
    children,
  }
}

async function getTree(
  params: Record<string, unknown>,
  userId: string,
  supabase: any
) {
  const contextId = params.context_id as string
  if (!contextId) throw new MethodError(-32602, 'Missing required param: context_id')

  // Fetch all non-archived endeavors in context
  const { data: endeavors, error: enError } = await supabase
    .from('endeavors')
    .select('id, title, description, status, node_type, context_id, created_at, updated_at, metadata')
    .eq('context_id', contextId)
    .is('archived_at', null)
    .order('created_at', { ascending: false })

  if (enError) throw new Error(`Database error: ${enError.message}`)

  const nodeIds = (endeavors ?? []).map((e: any) => e.id)

  // Fetch edges within this set
  let edges: any[] = []
  if (nodeIds.length > 0) {
    const { data: edgeData } = await supabase
      .from('edges')
      .select('from_endeavor_id, to_endeavor_id, relationship')
      .in('from_endeavor_id', nodeIds)
      .eq('relationship', 'contains')
    edges = edgeData ?? []
  }

  // Build parent map
  const parentMap: Record<string, string> = {}
  for (const edge of edges) {
    parentMap[edge.to_endeavor_id] = edge.from_endeavor_id
  }

  // Annotate nodes with parent_id and assemble tree
  const nodes = (endeavors ?? []).map((e: any) => ({
    ...e,
    parent_id: parentMap[e.id] ?? null,
  }))

  // Build nested tree structure
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

async function searchEndeavors(
  params: Record<string, unknown>,
  userId: string,
  supabase: any
) {
  const q = params.query as string
  if (!q) throw new MethodError(-32602, 'Missing required param: query')

  const limit = typeof params.limit === 'number' ? params.limit : 20

  // Use ilike for text search (works without tsvector columns)
  let qb = supabase
    .from('endeavors')
    .select('id, title, description, status, node_type, context_id, created_at, updated_at, metadata')
    .is('archived_at', null)
    .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (params.context_id) {
    qb = qb.eq('context_id', params.context_id as string)
  }

  const { data, error } = await qb
  if (error) throw new Error(`Database error: ${error.message}`)
  return { endeavors: data ?? [], query: q }
}

// ---- Error class for method-level errors ----

class MethodError extends Error {
  code: number
  data?: unknown
  constructor(code: number, message: string, data?: unknown) {
    super(message)
    this.code = code
    this.data = data
  }
}

// ---- Method dispatch ----

const METHODS: Record<
  string,
  (params: Record<string, unknown>, userId: string, supabase: any) => Promise<unknown>
> = {
  list_endeavors: listEndeavors,
  get_endeavor: getEndeavor,
  get_tree: getTree,
  search_endeavors: searchEndeavors,
}

// ---- Route handler ----

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
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const result = await handler(body.params ?? {}, user.id, supabase)
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
