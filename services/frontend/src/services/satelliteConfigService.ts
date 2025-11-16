import { getEnv } from '@/utils/env'

// Updated types to match the new array-based API response
export interface JsonAction {
  type: 'json'
  category?: string
  jsonContent?: string
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
  title?: string
  description?: string
  inputType?: 'input' | 'textarea'
}

export interface LinkAction {
  type: 'link'
  category?: string
  url: string
  name?: string
  description?: string
  imageUrl?: string
  buttonText?: string
}

export interface TextAction {
  type: 'text'
  category?: string
  content: string
  title?: string
  description?: string
}

export interface CommandAction {
  type: 'command'
  category?: string
  command: string
  title?: string
  description?: string
  inputType?: 'input' | 'textarea'
}

export interface Step {
  name: string
  required: boolean
  content: string
}

export interface StepsAction {
  type: 'steps'
  category?: string
  steps: Step[]
  title?: string
  description?: string
}

export type ConfigAction = JsonAction | LinkAction | TextAction | CommandAction | StepsAction
export type ClientConfigResponse = ConfigAction[]

export interface ClientInfo {
  id: string
  name: string
  iconPath: string
  description?: string
}

export interface ClientCategory {
  id: string
  name: string
  description: string
  clients: ClientInfo[]
}

interface ClientsListResponse {
  categories: ClientCategory[]
}

export class GatewayConfigService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

  // Updated to use the new satellite endpoint with category filtering
  static async getClientConfig(client: string, category: string = 'connection'): Promise<ClientConfigResponse> {
    const response = await fetch(`${this.baseUrl}/api/me/satellite/config/${category}/${client}`, {
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

  // Get all configuration actions for a client (all categories)
  static async getAllClientConfig(client: string): Promise<ClientConfigResponse> {
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

  // Updated to use the new satellite clients endpoint with categories
  static async getSupportedClients(): Promise<ClientInfo[]> {
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

    // Flatten categories to get all unique clients
    const allClients = new Map<string, ClientInfo>()
    for (const category of data.categories) {
      for (const client of category.clients) {
        allClients.set(client.id, client)
      }
    }

    return Array.from(allClients.values())
  }

  // Get all categories with clients (categorized structure)
  static async getClientCategoriesWithClients(): Promise<ClientCategory[]> {
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
    return data.categories
  }

  // Get all categories with clients
  static async getClientCategories(): Promise<ClientCategory[]> {
    const response = await fetch(`${this.baseUrl}/api/me/satellite/clients`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to fetch client categories')
    }

    const data: ClientsListResponse = await response.json()
    return data.categories
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

  // Helper method to extract command actions from the response
  static getCommandActions(response: ClientConfigResponse): CommandAction[] {
    return response.filter(action => action.type === 'command') as CommandAction[]
  }

  // Helper method to get the primary command action
  static getCommandAction(response: ClientConfigResponse): CommandAction | null {
    return response.find(action => action.type === 'command') as CommandAction || null
  }

  // Helper method to extract steps actions from the response
  static getStepsActions(response: ClientConfigResponse): StepsAction[] {
    return response.filter(action => action.type === 'steps') as StepsAction[]
  }

  // Helper method to get the primary steps action
  static getStepsAction(response: ClientConfigResponse): StepsAction | null {
    return response.find(action => action.type === 'steps') as StepsAction || null
  }

  // Helper method to get formatted content for display (JSON, text, or command)
  static getFormattedContent(response: ClientConfigResponse): string {
    // Check for command action first
    const commandAction = this.getCommandAction(response)
    if (commandAction) {
      return commandAction.command
    }

    // Check for text action
    const textAction = this.getTextAction(response)
    if (textAction) {
      return textAction.content
    }

    // Fall back to JSON configuration
    const jsonAction = this.getJsonConfig(response)
    if (!jsonAction) return ''

    // Use jsonContent if available (pre-formatted JSON string)
    if (jsonAction.jsonContent) {
      return jsonAction.jsonContent
    }

    // Legacy fallback: Create a clean object without the 'type' field for display
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { type: _type, ...configData } = jsonAction
    return JSON.stringify(configData, null, 2)
  }

  // Legacy method - kept for backward compatibility
  static getFormattedJsonConfig(response: ClientConfigResponse): string {
    return this.getFormattedContent(response)
  }
}
