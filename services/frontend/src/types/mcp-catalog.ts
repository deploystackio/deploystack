export interface McpServerSearchParams {
  q: string
  category?: string
  language?: string
  runtime?: string
  status?: 'active' | 'deprecated' | 'maintenance'
  featured?: boolean
  sort_by?: 'name' | 'github_stars'
  limit?: number
  offset?: number
}

export interface McpServerSearchResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  servers: any[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
  filters: {
    query: string
    category: string | null
    language: string | null
    runtime: string | null
    status: string | null
    featured: boolean | null
  }
}
