import { getEnv } from '@/utils/env'

// Updated types to match the new array-based API response
export interface JsonAction {
  type: 'json'
  // Claude Desktop / Cursor / Windsurf / Cline format
  mcpServers?: {
    [key: string]: {
      url?: string
      name?: string
      description?: string
      transport?: string
      type?: string
      env?: { [key: string]: string }
      headers?: { [key: string]: string }
      [key: string]: string | number | boolean | object | undefined
    }
  }
  // VS Code specific format
  inputs?: Array<{
    type: string
    id: string
    description: string
    password?: boolean
  }>
  servers?: {
    [key: string]: {
      type: string
      url?: string
      headers?: { [key: string]: string }
      [key: string]: string | number | boolean | object | undefined
    }
  }
}

export interface LinkAction {
  type: 'link'
  url: string
  name?: string
  description?: string
}

export interface TextAction {
  type: 'text'
  content: string
  title?: string
  description?: string
}

export type ConfigAction = JsonAction | LinkAction | TextAction
export type ClientConfigResponse = ConfigAction[]

interface ClientsListResponse {
  clients: string[]
}

export class GatewayConfigService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  // Updated to use the new satellite endpoint and handle array response
  static async getClientConfig(client: string): Promise<ClientConfigResponse> {
    const response = await fetch(`${this.baseUrl}/api/me/satellite/config/${client}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ${client} configuration`)
    }

    const data: ClientConfigResponse = await response.json()
    return data
  }

  // Updated to use the new satellite clients endpoint
  static async getSupportedClients(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/api/me/satellite/clients`, {
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

  // Helper method to extract JSON configuration from the response array
  static getJsonConfig(response: ClientConfigResponse): JsonAction | null {
    return response.find(action => action.type === 'json') as JsonAction || null
  }

  // Helper method to extract link actions (like Cursor deeplinks) from the response
  static getLinkActions(response: ClientConfigResponse): LinkAction[] {
    return response.filter(action => action.type === 'link') as LinkAction[]
  }

  // Helper method to extract text actions from the response
  static getTextActions(response: ClientConfigResponse): TextAction[] {
    return response.filter(action => action.type === 'text') as TextAction[]
  }

  // Helper method to get the primary text action
  static getTextAction(response: ClientConfigResponse): TextAction | null {
    return response.find(action => action.type === 'text') as TextAction || null
  }

  // Helper method to get formatted content for display (JSON or text)
  static getFormattedContent(response: ClientConfigResponse): string {
    // Check for text action first
    const textAction = this.getTextAction(response)
    if (textAction) {
      return textAction.content
    }

    // Fall back to JSON configuration
    const jsonAction = this.getJsonConfig(response)
    if (!jsonAction) return ''

    // Create a clean object without the 'type' field for display
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type: _type, ...configData } = jsonAction
    return JSON.stringify(configData, null, 2)
  }

  // Legacy method - kept for backward compatibility
  static getFormattedJsonConfig(response: ClientConfigResponse): string {
    return this.getFormattedContent(response)
  }
}
