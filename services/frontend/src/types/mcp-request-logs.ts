export interface McpRequestLogUser {
  user_id: string
  user_name: string
  email: string
}

// Base interface for list items (no tool_response for performance)
export interface McpRequestLog {
  id: string
  user: McpRequestLogUser | null
  tool_name: string
  tool_params: unknown
  response_time_ms: number
  success: boolean
  error_message: string | null
  created_at: string
}

// Extended interface for detail view (includes tool_response)
export interface McpRequestLogDetail extends McpRequestLog {
  tool_response: unknown
}
