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
  created_at: string
  updated_at: string
}

export interface TeamsApiResponse {
  success: boolean
  data: Team[]
}

export interface UpdateTeamAdminRequest {
  name?: string
  description?: string | null
  non_http_mcp_limit?: number
  mcp_server_limit?: number
  member_limit?: number
}

export interface UpdateTeamResponse {
  success: boolean
  message: string
  data: Team
}
