import { DatabaseNodeType } from '../contracts/endeavor-contract'

// Core data model for import system
export interface ImportEndeavor {
  id: string              // deterministic ID
  slug: string           // URL-friendly slug
  title: string
  summary?: string       // compact summary (≤220 chars)
  body_md?: string       // raw markdown slice
  tags?: string[]
  node_type: DatabaseNodeType    // Type of endeavor (Mission, Aim, etc.)
  provenance: {
    source_uri?: string
    imported_at: string  // ISO timestamp
    by: string           // user ID
    hash: string         // content hash for idempotency
  }
}


export interface ImportEdge {
  from_id: string
  kind: string  // Edge type (since EdgeType was removed)
  to_id: string
  asserted_at: string    // ISO timestamp
  source: 'importer' | 'llm' | 'user'
  confidence: number     // 0..1
}

// Similarity matching system types
export interface NodeSignature {
  id: string
  canonical_slug: string
  alias_slugs: string[]
  title: string
  summary_220: string    // compact ≤220 char rewrite
  top_tags: string[]
  node_type: DatabaseNodeType
  embedding?: number[]   // vector embedding
  last_seen_at: string
}

export interface ImportSignature {
  title: string
  summary_220: string
  tags: string[]
  node_type: DatabaseNodeType
  embedding?: number[]
}

export interface MatchCandidate {
  signature: NodeSignature
  similarity_score: number
  fuzzy_title_score?: number
}

export interface LLMJudgment {
  best_match_id: string | null
  likelihood: number     // 0..1
  rationale: string
  alt_matches: Array<{
    id: string
    likelihood: number
  }>
}

// Upsert policy configuration
export interface UpsertPolicy {
  merge_titles?: boolean
  overwrite_outcome?: boolean
  auto_link?: boolean    // auto-link in REVIEW band (0.78-0.87)
  similarity_threshold?: {
    update: number       // default 0.87
    review_band: number  // default 0.78
  }
}

// Import configuration
export interface ImportOptions {
  source_uri?: string
  upsert_policy?: UpsertPolicy
  dry_run?: boolean
  user_id: string
}

// Parsed markdown structure
export interface ParsedSection {
  type: 'mission' | 'aim' | 'initiative' | 'strength' | 'accomplishment' | 'achievement'
  title: string
  content: string
  raw_markdown: string
  line_range: [number, number]  // [start, end] lines
  extras: {
    tactics?: string[]
    signals?: string[]
    cues?: string[]
    horizon?: string
    outcome?: string
  }
}


// UPSERT operation results
export interface UpsertAction {
  action: 'INSERT' | 'UPDATE' | 'REVIEW' | 'SKIP'
  endeavor: ImportEndeavor
  matched_node_id?: string
  match_confidence?: number
  rationale?: string
}

export interface UpsertPlan {
  actions: UpsertAction[]
  edges: ImportEdge[]
  warnings: string[]
}

export interface ImportReport {
  summary: {
    total_sections: number
    created: number
    updated: number
    unchanged: number
    review_required: number
    failed: number
  }
  actions: UpsertAction[]
  edges_added: number
  warnings: string[]
  errors: string[]
  processing_time_ms: number
}


// Embedding service types
export interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>
  computeSimilarity(embedding1: number[], embedding2: number[]): number
}

// LLM service types for adjudication
export interface AdjudicationService {
  judgeMatch(
    importSignature: ImportSignature,
    candidates: MatchCandidate[]
  ): Promise<LLMJudgment>
  
  batchJudgeMatches(
    matchRequests: Array<{
      importSignature: ImportSignature
      candidates: MatchCandidate[]
    }>
  ): Promise<LLMJudgment[]>
  
  extractStructuredData(
    section: ParsedSection
  ): Promise<{
    title: string
    summary: string
    role: DatabaseNodeType
    horizon?: string
    tactics?: string[]
    signals?: string[]
    confidence: number
  }>
}

// Export main interfaces for the importer
export interface MarkdownAimsImporter {
  parseMarkdown(markdown: string): Promise<UpsertPlan>
  commitPlan(plan: UpsertPlan, userId: string): Promise<ImportReport>
}