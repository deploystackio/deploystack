import request from 'supertest';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs-extra';
import * as path from 'path';
import { getTestContext } from './testContext';
import { GlobalSettings } from '../../src/global-settings';
import { initializeDatabase } from '../../src/db';

// __dirname is services/backend/tests/e2e
const APP_BACKEND_ROOT = path.join(__dirname, '..', '..'); // Resolves to services/backend/
const DB_FILE_PATH = path.join(__dirname, 'test-data', 'deploystack.test.db'); // Path where the app creates the test db

describe('Global Settings Helper Methods E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;
  let adminCookie: string;

  beforeAll(async () => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;

    // Ensure database is initialized for direct helper method access
    // The server should have already initialized it, but we need to make sure
    // it's available for direct database access outside the server context
    try {
      await initializeDatabase();
    } catch (error) {
      // Database might already be initialized, which is fine
      console.log('Database initialization note:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Login as admin to create test settings
    const adminLoginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'admin@example.com',
        password: 'SecurePassword123!'
      });
    
    if (adminLoginResponse.status !== 200) {
      throw new Error(`Admin login failed: ${adminLoginResponse.status} - ${JSON.stringify(adminLoginResponse.body)}`);
    }
    
    adminCookie = adminLoginResponse.headers['set-cookie'][0];

    // Create a test setting for the helper methods to retrieve
    const testSettingData = {
      key: 'test.helper.string',
      value: 'test-helper-value',
      type: 'string',
      description: 'Test setting for helper methods',
      encrypted: false,
      group_id: 'smtp' // Use existing group
    };

    await request(server.server)
      .post('/api/settings')
      .set('Cookie', adminCookie)
      .send(testSettingData);

    // Wait a moment for the setting to be fully committed
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // Clean up test setting
    try {
      await request(server.server)
        .delete('/api/settings/test.helper.string')
        .set('Cookie', adminCookie);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('GlobalSettings Helper Methods', () => {
    it('should retrieve a string value using getString helper method', async () => {
      // Ensure database exists
      expect(await fs.pathExists(DB_FILE_PATH)).toBe(true);

      // Test the getString helper method
      const value = await GlobalSettings.getString('test.helper.string');
      
      expect(value).toBe('test-helper-value');
    });

    it('should return null for non-existent setting using getString', async () => {
      const value = await GlobalSettings.getString('non.existent.setting');
      
      expect(value).toBeNull();
    });

    it('should return default value for non-existent setting using getString', async () => {
      const value = await GlobalSettings.getString('non.existent.setting', 'default-value');
      
      expect(value).toBe('default-value');
    });
  });
});
