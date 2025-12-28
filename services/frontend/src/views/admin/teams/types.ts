export interface Team {
  id: string
  name: string
  slug: string
  description: string | null
  owner_id: string
  is_default: boolean
  non_http_mcp_limit: number
  mcp_server_limit: number
  member_limit: number
  allow_remote_mcp: boolean
  created_at: string
  updated_at: string
}

export interface PaginationParams {
  limit?: number
  offset?: number
}

export interface PaginationMeta {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface TeamSearchParams extends PaginationParams {
  name?: string
}

export interface PaginatedTeamsResponse {
  teams: Team[]
  pagination: PaginationMeta
}

export interface TeamsApiResponse {
  success: boolean
  data: {
    teams: Team[]
    pagination: PaginationMeta
  }
}

export interface UpdateTeamAdminRequest {
  name?: string
  description?: string | null
  non_http_mcp_limit?: number
  mcp_server_limit?: number
  member_limit?: number
  allow_remote_mcp?: boolean
}

export interface UpdateTeamResponse {
  success: boolean
  message: string
  data: Team
}
