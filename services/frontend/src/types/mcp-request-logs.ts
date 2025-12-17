export interface McpRequestLog {
  id: string
  user_id: string | null
  tool_name: string
  tool_params: unknown
  tool_response: unknown
  response_time_ms: number
  success: boolean
  error_message: string | null
  created_at: string
}
