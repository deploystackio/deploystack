import { getEnv } from '@/utils/env';
import type { DbStatusResponse, DbSetupRequest, DbSetupResponse } from '@/types/database';

class DatabaseService {
  private baseUrl: string;
  private storageKey: string;

  constructor() {
    this.baseUrl = getEnv('VITE_DEPLOYSTACK_APP_URL') || 'http://localhost:3000';
    this.storageKey = `deploystack_db_setup_status_${this.baseUrl}`;
  }

  /**
   * Check database status from backend
   */
  async checkStatus(): Promise<DbStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/status`, {
        method: 'GET',
        credentials: 'include', // Include cookies for session management
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Cache the result in localStorage
      this.cacheSetupStatus(data.configured && data.initialized);

      return data;
    } catch (error) {
      console.error('Failed to check database status:', error);
      // Throw an error object that the store can inspect
      throw {
        isCustomError: true,
        i18nKey: 'setup.errors.failedToConnectWithAddress',
        address: this.baseUrl
      };
    }
  }

  /**
   * Setup database with given configuration
   */
  async setupDatabase(config: DbSetupRequest): Promise<DbSetupResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/db/setup`, {
        method: 'POST',
        credentials: 'include', // Include cookies for session management
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
      }

      // Cache successful setup
      this.cacheSetupStatus(true);

      return data;
    } catch (error) {
      console.error('Failed to setup database:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('setup.errors.setupFailed');
    }
  }

  /**
   * Get cached setup status from localStorage
   */
  getCachedSetupStatus(): boolean | null {
    try {
      const cached = localStorage.getItem(this.storageKey);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  /**
   * Cache setup status in localStorage
   */
  private cacheSetupStatus(isSetup: boolean): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(isSetup));
    } catch (error) {
      console.warn('Failed to cache setup status:', error);
    }
  }

  /**
   * Clear cached setup status (useful for testing)
   */
  clearCache(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (error) {
      console.warn('Failed to clear setup status cache:', error);
    }
  }
}

export const databaseService = new DatabaseService();
