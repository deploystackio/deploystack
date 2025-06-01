import { getEnv } from '@/utils/env';

export interface User {
  id: string;
  email: string;
  // Add other user properties as needed
}

export class UserService {
  private static getApiUrl(): string {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL');
    if (!apiUrl) {
      throw new Error('API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.');
    }
    return apiUrl;
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const apiUrl = this.getApiUrl();
      const response = await fetch(`${apiUrl}/api/users/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for sending session cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data as User;
        }
        // If success is false or data is missing, treat as not logged in for this check
        return null;
      }

      if (response.status === 401) {
        // Unauthorized, user is not logged in
        return null;
      }

      // For other errors, we might not want to block navigation,
      // but for the purpose of this check, any error means we can't confirm the user.
      console.error('Failed to fetch current user:', response.status);
      return null;
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      return null; // Network error or other issues
    }
  }
}
