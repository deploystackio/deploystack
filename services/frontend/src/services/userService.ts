import { getEnv } from '@/utils/env';
import { TeamService } from './teamService';

export interface User {
  id: string;
  email: string;
  username?: string;
  role_id: string;
  first_name?: string;
  last_name?: string;
  // Add other user properties as needed
}

interface CacheEntry {
  data: User | null;
  timestamp: number;
  promise?: Promise<User | null>;
}

export class UserService {
  private static cache: CacheEntry | null = null;
  private static readonly CACHE_DURATION = 30000; // 30 seconds
  private static pendingRequest: Promise<User | null> | null = null;

  private static getApiUrl(): string {
    const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL');
    if (!apiUrl) {
      throw new Error('API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.');
    }
    return apiUrl;
  }

  /**
   * Clear the user cache - call this on login/logout to ensure fresh data
   */
  static clearCache(): void {
    this.cache = null;
    this.pendingRequest = null;
    // Also clear team cache since teams are user-specific
    TeamService.clearUserTeamsCache();
  }

  /**
   * Check if cached data is still valid
   */
  private static isCacheValid(): boolean {
    if (!this.cache) return false;
    return Date.now() - this.cache.timestamp < this.CACHE_DURATION;
  }

  /**
   * Get current user with smart caching to prevent duplicate API calls
   * @param forceRefresh - Force a fresh API call, bypassing cache
   */
  static async getCurrentUser(forceRefresh = false): Promise<User | null> {
    // If force refresh is requested, clear cache first
    if (forceRefresh) {
      this.clearCache();
    }

    // Return cached data if valid
    if (!forceRefresh && this.isCacheValid() && this.cache) {
      return this.cache.data;
    }

    // If there's already a pending request, return it to prevent duplicate calls
    if (this.pendingRequest) {
      return this.pendingRequest;
    }

    // Make the API call
    this.pendingRequest = this.fetchCurrentUser();
    
    try {
      const result = await this.pendingRequest;
      
      // Cache the result
      this.cache = {
        data: result,
        timestamp: Date.now()
      };
      
      return result;
    } finally {
      // Clear pending request
      this.pendingRequest = null;
    }
  }

  /**
   * Internal method to fetch user data from API
   */
  private static async fetchCurrentUser(): Promise<User | null> {
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
      console.error('Error in fetchCurrentUser:', error);
      return null; // Network error or other issues
    }
  }

  /**
   * Login method - clears cache to ensure fresh user data after login
   */
  static async login(email: string, password: string): Promise<any> {
    try {
      const apiUrl = this.getApiUrl();
      const response = await fetch(`${apiUrl}/api/auth/email/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          login: email,
          password: password,
        }),
      });

      if (response.ok) {
        // Clear cache on successful login to ensure fresh user data
        this.clearCache();
        return await response.json();
      }

      throw new Error(`Login failed with status: ${response.status}`);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Logout method - clears cache
   */
  static async logout(): Promise<void> {
    try {
      const apiUrl = this.getApiUrl();
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } finally {
      // Always clear cache on logout, even if the API call fails
      this.clearCache();
    }
  }
}
