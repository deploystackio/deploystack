// Shared team-related type definitions based on API schema

export interface TeamMember {
  id: string
  user_id: string
  role: 'team_admin' | 'team_user'
  joined_at: string
  username: string
  email: string
  first_name: string | null
  last_name: string | null
  is_admin: boolean
  is_owner: boolean
}

export interface DisplayMember {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}
