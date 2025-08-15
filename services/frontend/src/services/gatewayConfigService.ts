import { getEnv } from '@/utils/env'

export class GatewayConfigService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  static async getClientConfig(client: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/gateway/config/${client}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ${client} configuration`)
    }

    return response.json()
  }
}
