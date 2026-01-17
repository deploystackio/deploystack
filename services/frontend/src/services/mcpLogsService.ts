import { getEnv } from '@/utils/env'

export class McpLogsService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  static getStreamUrl(
    teamId: string,
    installationId: string,
    options?: { level?: 'info' | 'warn' | 'error' | 'debug'; limit?: number }
  ): string {
    const params = new URLSearchParams()
    if (options?.level) params.set('level', options.level)
    if (options?.limit) params.set('limit', String(options.limit))
    const queryString = params.toString()
    return `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/logs/stream${queryString ? `?${queryString}` : ''}`
  }

  static getRestUrl(
    teamId: string,
    installationId: string,
    options?: { level?: 'info' | 'warn' | 'error' | 'debug'; limit?: number; offset?: number }
  ): string {
    const params = new URLSearchParams()
    if (options?.level) params.set('level', options.level)
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))
    const queryString = params.toString()
    return `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/logs${queryString ? `?${queryString}` : ''}`
  }
}
