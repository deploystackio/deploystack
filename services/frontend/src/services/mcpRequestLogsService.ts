import { getEnv } from '@/utils/env'

export class McpRequestLogsService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  static getStreamUrl(
    teamId: string,
    installationId: string,
    options?: { success?: boolean; limit?: number }
  ): string {
    const params = new URLSearchParams()
    if (options?.success !== undefined) params.set('success', String(options.success))
    if (options?.limit) params.set('limit', String(options.limit))
    const queryString = params.toString()
    return `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/requests/stream${queryString ? `?${queryString}` : ''}`
  }

  static getRestUrl(
    teamId: string,
    installationId: string,
    options?: { success?: boolean; limit?: number; offset?: number }
  ): string {
    const params = new URLSearchParams()
    if (options?.success !== undefined) params.set('success', String(options.success))
    if (options?.limit) params.set('limit', String(options.limit))
    if (options?.offset) params.set('offset', String(options.offset))
    const queryString = params.toString()
    return `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/requests${queryString ? `?${queryString}` : ''}`
  }

  static getDetailUrl(
    teamId: string,
    installationId: string,
    requestId: string
  ): string {
    return `${this.baseUrl}/api/teams/${teamId}/mcp/installations/${installationId}/requests/${requestId}`
  }
}
