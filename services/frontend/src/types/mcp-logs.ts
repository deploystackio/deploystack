export interface McpLog {
  id: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  metadata: object | null
  created_at: string
}
