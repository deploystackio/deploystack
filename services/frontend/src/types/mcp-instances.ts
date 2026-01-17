export interface McpInstance {
  id: string
  user_id: string
  user_slug: string
  user_email: string
  status: 'provisioning' | 'command_received' | 'connecting' | 'discovering_tools' |
          'syncing_tools' | 'online' | 'offline' | 'restarting' | 'error' |
          'requires_reauth' | 'permanently_failed' | 'awaiting_user_config'
  status_message: string | null
  status_updated_at: string
  last_health_check_at: string | null
  created_at: string
  updated_at: string
}

export interface GetInstancesResponse {
  success: boolean
  data: McpInstance[]
}
