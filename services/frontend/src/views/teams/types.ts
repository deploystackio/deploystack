export interface TeamsApiResponse {
  success: boolean
  data: TeamWithRole[]
}

export interface TeamWithRole {
  id: string
  name: string
  slug: string
  description: string | null
  owner_id: string
  created_at: Date
  updated_at: Date
  role: 'team_admin' | 'team_user'
}
