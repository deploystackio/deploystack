import { getEnv } from '@/utils/env'

interface ClientsListResponse {
  clients: string[]
}

export class GatewayConfigService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  static async getSupportedClients(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/gateway/config/clients`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch supported clients list')
    }

    const data: ClientsListResponse = await response.json()
    return data.clients
  }
}
