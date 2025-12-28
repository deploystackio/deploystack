export interface User {
  id: string
  username: string
  email: string
  auth_type: string | null
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

export interface UserSearchParams extends PaginationParams {
  username?: string
  email?: string
  auth_type?: 'email' | 'github'
  role_id?: string
}

export interface PaginatedUsersResponse {
  users: User[]
  pagination: PaginationMeta
}

export interface UsersApiResponse {
  success: boolean
  data: {
    users: User[]
    pagination: {
      total: number
      limit: number
      offset: number
      has_more: boolean
    }
  }
}
