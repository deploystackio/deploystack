export interface User {
  id: string
  username: string
  email: string
  auth_type: string
  first_name: string | null
  last_name: string | null
  github_id: string | null
  role_id: string | null
  role?: {
    id: string
    name: string
    permissions: string[]
  }
}

export interface UsersApiResponse {
  success: boolean
  data: User[]
}
