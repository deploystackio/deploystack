import { ref } from 'vue'
import { getEnv } from '@/utils/env'

export interface ConnectionTestResult {
  success: boolean
  message: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: Record<string, any>
  timestamp: Date
}

export interface ConnectionTestOptions {
  endpoint?: string
  timeout?: number
  retries?: number
}

/**
 * Composable for testing connections to external services
 */
export function useConnectionTest() {
  const isTestingConnection = ref(false)
  const lastTestResult = ref<ConnectionTestResult | null>(null)

  const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

  /**
   * Test a connection using the backend API
   * @param serviceType - Type of service to test (e.g., 'github-app', 'smtp')
   * @param credentials - Credentials or configuration to test
   * @param options - Additional options for the test
   */
  async function testConnection(
    serviceType: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    credentials: Record<string, any>,
    options: ConnectionTestOptions = {}
  ): Promise<ConnectionTestResult> {
    if (!apiUrl) {
      throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured')
    }

    isTestingConnection.value = true

    try {
      const endpoint = options.endpoint || `/api/settings/test-connection/${serviceType}`

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          credentials,
          options: {
            timeout: options.timeout || 10000,
            retries: options.retries || 1
          }
        }),
      })

      const result = await response.json()

      const testResult: ConnectionTestResult = {
        success: response.ok && result.success,
        message: result.message || (response.ok ? 'Connection successful' : 'Connection failed'),
        details: result.details,
        timestamp: new Date()
      }

      lastTestResult.value = testResult
      return testResult

    } catch (error) {
      const testResult: ConnectionTestResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }

      lastTestResult.value = testResult
      return testResult

    } finally {
      isTestingConnection.value = false
    }
  }

  /**
   * Test GitHub App connection
   */
  async function testGitHubAppConnection(): Promise<ConnectionTestResult> {
    if (!apiUrl) {
      throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured')
    }

    isTestingConnection.value = true

    try {
      const response = await fetch(`${apiUrl}/api/settings/github-app/test-connection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        // Send empty JSON object as body to satisfy any body parsing middleware
        body: JSON.stringify({})
      })

      const result = await response.json()

      const testResult: ConnectionTestResult = {
        success: response.ok && result.success,
        message: result.message || (response.ok ? 'Connection successful' : 'Connection failed'),
        details: result.details,
        timestamp: new Date()
      }

      lastTestResult.value = testResult
      return testResult

    } catch (error) {
      const testResult: ConnectionTestResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date()
      }

      lastTestResult.value = testResult
      return testResult

    } finally {
      isTestingConnection.value = false
    }
  }

  /**
   * Test SMTP connection
   */
  async function testSmtpConnection(credentials: {
    host: string
    port: number
    username: string
    password: string
    secure: boolean
  }): Promise<ConnectionTestResult> {
    return testConnection('smtp', credentials)
  }

  /**
   * Clear the last test result
   */
  function clearTestResult() {
    lastTestResult.value = null
  }

  /**
   * Get a user-friendly status message based on the test result
   */
  function getStatusMessage(result: ConnectionTestResult | null): string {
    if (!result) return ''

    if (result.success) {
      return result.message || 'Connection successful'
    } else {
      return result.message || 'Connection failed'
    }
  }

  /**
   * Get the appropriate alert variant based on the test result
   */
  function getAlertVariant(result: ConnectionTestResult | null): 'default' | 'destructive' {
    if (!result) return 'default'
    return result.success ? 'default' : 'destructive'
  }

  return {
    isTestingConnection,
    lastTestResult,
    testConnection,
    testGitHubAppConnection,
    testSmtpConnection,
    clearTestResult,
    getStatusMessage,
    getAlertVariant
  }
}
