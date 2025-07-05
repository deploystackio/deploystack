import { getEnv } from '@/utils/env'
import type {
  CloudProvider,
  CloudCredential,
  CloudCredentialBasic,
  CreateCredentialInput,
  UpdateCredentialInput,
  CloudProvidersResponse,
  CloudCredentialsResponse,
  CloudCredentialResponse,
  SearchCredentialsResponse,
  ApiError
} from '@/types/credentials'

export class CredentialsService {
  private static getApiUrl(): string {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    if (!apiUrl) {
      throw new Error('API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.')
    }
    return apiUrl
  }

  /**
   * Get all cloud providers available for a team
   */
  static async getCloudProviders(teamId: string): Promise<CloudProvider[]> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/${teamId}/cloud-providers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        throw new Error(`Failed to fetch cloud providers: ${response.status}`)
      }

      const data: CloudProvidersResponse = await response.json()

      if (!data.success) {
        throw new Error((data as unknown as ApiError).error)
      }

      return data.data
    } catch (error) {
      console.error('Error fetching cloud providers:', error)
      throw error
    }
  }

  /**
   * Get all credentials for a team
   */
  static async getTeamCredentials(teamId: string): Promise<CloudCredential[]> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/${teamId}/cloud-credentials`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        throw new Error(`Failed to fetch team credentials: ${response.status}`)
      }

      const data: CloudCredentialsResponse = await response.json()

      if (!data.success) {
        throw new Error((data as unknown as ApiError).error)
      }

      return data.data
    } catch (error) {
      console.error('Error fetching team credentials:', error)
      throw error
    }
  }

  /**
   * Search credentials within a team by name or comment
   */
  static async searchCredentials(
    teamId: string,
    query: string,
    limit: number = 50
  ): Promise<CloudCredentialBasic[]> {
    try {
      const apiUrl = this.getApiUrl()
      const searchParams = new URLSearchParams({ q: query, limit: limit.toString() })

      const response = await fetch(`${apiUrl}/api/teams/${teamId}/cloud-credentials/search?${searchParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        throw new Error(`Failed to search credentials: ${response.status}`)
      }

      const data: SearchCredentialsResponse = await response.json()

      if (!data.success) {
        throw new Error((data as unknown as ApiError).error)
      }

      return data.data
    } catch (error) {
      console.error('Error searching credentials:', error)
      throw error
    }
  }

  /**
   * Get a specific credential by ID
   */
  static async getCredential(teamId: string, credentialId: string): Promise<CloudCredential> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/${teamId}/cloud-credentials/${credentialId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        if (response.status === 404) {
          throw new Error('Credential not found')
        }
        throw new Error(`Failed to fetch credential: ${response.status}`)
      }

      const data: CloudCredentialResponse = await response.json()

      if (!data.success) {
        throw new Error((data as unknown as ApiError).error)
      }

      return data.data
    } catch (error) {
      console.error('Error fetching credential:', error)
      throw error
    }
  }

  /**
   * Create a new credential
   */
  static async createCredential(
    teamId: string,
    input: CreateCredentialInput
  ): Promise<CloudCredential> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/${teamId}/cloud-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        if (response.status === 409) {
          throw new Error('A credential with this name already exists for this provider')
        }

        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to create credential: ${response.status}`)
      }

      const data: CloudCredentialResponse = await response.json()

      if (!data.success) {
        throw new Error((data as unknown as ApiError).error)
      }

      return data.data
    } catch (error) {
      console.error('Error creating credential:', error)
      throw error
    }
  }

  /**
   * Update an existing credential
   */
  static async updateCredential(
    teamId: string,
    credentialId: string,
    input: UpdateCredentialInput
  ): Promise<CloudCredential> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/${teamId}/cloud-credentials/${credentialId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        if (response.status === 404) {
          throw new Error('Credential not found')
        }
        if (response.status === 409) {
          throw new Error('A credential with this name already exists for this provider')
        }

        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to update credential: ${response.status}`)
      }

      const data: CloudCredentialResponse = await response.json()

      if (!data.success) {
        throw new Error((data as unknown as ApiError).error)
      }

      return data.data
    } catch (error) {
      console.error('Error updating credential:', error)
      throw error
    }
  }

  /**
   * Delete a credential
   */
  static async deleteCredential(teamId: string, credentialId: string): Promise<void> {
    try {
      const apiUrl = this.getApiUrl()

      const response = await fetch(`${apiUrl}/api/teams/${teamId}/cloud-credentials/${credentialId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - please log in')
        }
        if (response.status === 403) {
          throw new Error('Insufficient permissions')
        }
        if (response.status === 404) {
          throw new Error('Credential not found')
        }

        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to delete credential: ${response.status}`)
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error((data as unknown as ApiError).error)
      }
    } catch (error) {
      console.error('Error deleting credential:', error)
      throw error
    }
  }

  /**
   * Validate credential data against provider schema
   */
  static validateCredentialData(
    provider: CloudProvider,
    credentials: Record<string, string>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const field of provider.fields) {
      const value = credentials[field.key]

      // Check required fields
      if (field.required && (!value || value.trim() === '')) {
        errors.push(`${field.label} is required`)
        continue
      }

      // Skip validation for empty optional fields
      if (!value || value.trim() === '') {
        continue
      }

      // Validate field constraints
      if (field.validation) {
        const { minLength, maxLength, pattern } = field.validation

        if (minLength && value.length < minLength) {
          errors.push(`${field.label} must be at least ${minLength} characters`)
        }

        if (maxLength && value.length > maxLength) {
          errors.push(`${field.label} must be ${maxLength} characters or less`)
        }

        if (pattern) {
          const regex = new RegExp(pattern)
          if (!regex.test(value)) {
            errors.push(`${field.label} format is invalid`)
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get provider by ID from a list of providers
   */
  static getProviderById(providers: CloudProvider[], providerId: string): CloudProvider | null {
    return providers.find(p => p.id === providerId) || null
  }

  /**
   * Format credential for display (hide secret values)
   */
  static formatCredentialForDisplay(credential: CloudCredential): CloudCredential {
    if (!credential.fields) return credential

    const formattedFields = { ...credential.fields }

    Object.keys(formattedFields).forEach(key => {
      const field = formattedFields[key]
      if (field.secret && field.value) {
        // Replace secret values with placeholder
        formattedFields[key] = {
          ...field,
          value: '••••••••'
        }
      }
    })

    return {
      ...credential,
      fields: formattedFields
    }
  }

  /**
   * Check if user can manage credentials (create, edit, delete)
   */
  static canManageCredentials(userPermissions: string[]): boolean {
    return userPermissions.includes('cloud_credentials.create') ||
           userPermissions.includes('cloud_credentials.edit') ||
           userPermissions.includes('cloud_credentials.delete')
  }

  /**
   * Check if user can view credentials
   */
  static canViewCredentials(userPermissions: string[]): boolean {
    return userPermissions.includes('cloud_credentials.view') ||
           this.canManageCredentials(userPermissions)
  }
}

export default CredentialsService
