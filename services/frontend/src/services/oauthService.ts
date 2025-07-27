import { getEnv } from '@/utils/env';

export interface ConsentDetails {
  success: boolean;
  request_id: string;
  client_id: string;
  client_name: string;
  user_email: string;
  scopes: Array<{
    name: string;
    description: string;
  }>;
  expires_at: string;
}

export interface ConsentDecision {
  success: boolean;
  redirect_url?: string;
  error?: string;
  error_description?: string;
}

export class OAuthService {
  private static getApiUrl(): string {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL');
    if (!apiUrl) {
      throw new Error('API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.');
    }
    return apiUrl;
  }

  /**
   * Get consent details for an OAuth authorization request
   */
  static async getConsentDetails(requestId: string): Promise<ConsentDetails> {
    try {
      const apiUrl = this.getApiUrl();
      const response = await fetch(`${apiUrl}/api/oauth2/consent/details?request_id=${encodeURIComponent(requestId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for sending session cookies
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        if (response.status === 404) {
          throw new Error('REQUEST_NOT_FOUND');
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error_description || 'INVALID_REQUEST');
        }

        throw new Error(`Failed to get consent details: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error_description || 'Failed to get consent details');
      }

      return data;
    } catch (error) {
      console.error('Error getting consent details:', error);
      throw error;
    }
  }

  /**
   * Submit consent decision (approve or deny)
   */
  static async submitConsentDecision(requestId: string, action: 'approve' | 'deny'): Promise<ConsentDecision> {
    try {
      const apiUrl = this.getApiUrl();
      const response = await fetch(`${apiUrl}/api/oauth2/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          request_id: requestId,
          action: action
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        if (response.status === 404) {
          throw new Error('REQUEST_NOT_FOUND');
        }
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error_description || 'INVALID_REQUEST');
        }

        throw new Error(`Failed to submit consent decision: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error_description || 'Failed to process consent decision');
      }

      return data;
    } catch (error) {
      console.error('Error submitting consent decision:', error);
      throw error;
    }
  }
}
