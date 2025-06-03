import request from 'supertest';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs-extra';
import * as path from 'path';
import { getTestContext } from './testContext';

const PERSISTENT_DATA_PATH = path.join(__dirname, '..', 'persistent_data');
const DB_FILE_PATH = path.join(PERSISTENT_DATA_PATH, 'database', 'deploystack.db');

describe('Global Settings Access Control E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;
  let adminCookie: string;
  let userCookie: string;

  beforeAll(async () => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;

    // Create fresh login sessions for this test suite
    // Login as admin (first user)
    const adminLoginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        email: 'admin@example.com',
        password: 'SecurePassword123!'
      });
    
    if (adminLoginResponse.status !== 200) {
      throw new Error(`Admin login failed: ${adminLoginResponse.status} - ${JSON.stringify(adminLoginResponse.body)}`);
    }
    
    adminCookie = adminLoginResponse.headers['set-cookie'][0];

    // Login as regular user (second user)
    const userLoginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        email: 'user@example.com',
        password: 'SecurePassword456!'
      });
    
    if (userLoginResponse.status !== 200) {
      throw new Error(`User login failed: ${userLoginResponse.status} - ${JSON.stringify(userLoginResponse.body)}`);
    }
    
    userCookie = userLoginResponse.headers['set-cookie'][0];
  });

  describe('Global Admin Access (should have full access)', () => {
    it('should allow global_admin to list all settings', async () => {
      // Ensure database and users exist (should be done by previous tests)
      expect(await fs.pathExists(DB_FILE_PATH)).toBe(true);

      const response = await request(server.server)
        .get('/api/settings')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should allow global_admin to list all categories', async () => {
      const response = await request(server.server)
        .get('/api/settings/categories')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should allow global_admin to create a new setting', async () => {
      const settingData = {
        key: 'test.setting.key',
        value: 'test-value',
        description: 'Test setting for E2E testing',
        encrypted: false,
        group_id: 'test-group'
      };

      const response = await request(server.server)
        .post('/api/settings')
        .set('Cookie', adminCookie)
        .send(settingData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.key).toBe(settingData.key);
      expect(response.body.data.value).toBe(settingData.value);
      expect(response.body.data.group_id).toBe(settingData.group_id);
    });

    it('should allow global_admin to get a specific setting', async () => {
      const response = await request(server.server)
        .get('/api/settings/test.setting.key')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.key).toBe('test.setting.key');
      expect(response.body.data.value).toBe('test-value');
    });

    it('should allow global_admin to update a setting', async () => {
      const updateData = {
        value: 'updated-test-value',
        description: 'Updated test setting',
        encrypted: false,
        group_id: 'test-group'
      };

      const response = await request(server.server)
        .put('/api/settings/test.setting.key')
        .set('Cookie', adminCookie)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.value).toBe(updateData.value);
      expect(response.body.data.description).toBe(updateData.description);
    });

    it('should allow global_admin to create an encrypted setting', async () => {
      const encryptedSettingData = {
        key: 'test.secret.key',
        value: 'super-secret-value',
        description: 'Test encrypted setting',
        encrypted: true,
        group_id: 'test-group'
      };

      const response = await request(server.server)
        .post('/api/settings')
        .set('Cookie', adminCookie)
        .send(encryptedSettingData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.key).toBe(encryptedSettingData.key);
      expect(response.body.data.is_encrypted).toBe(true);
      // Value should be decrypted in response for admin
      expect(response.body.data.value).toBe(encryptedSettingData.value);
    });

    it('should allow global_admin to get settings by group', async () => {
      const response = await request(server.server)
        .get('/api/settings/group/test-group')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      // Should contain our test settings
      const testSetting = response.body.data.find((s: any) => s.key === 'test.setting.key');
      expect(testSetting).toBeDefined();
      expect(testSetting.value).toBe('updated-test-value');
    });

    it('should allow global_admin to search settings', async () => {
      const searchData = {
        pattern: 'test'
      };

      const response = await request(server.server)
        .post('/api/settings/search')
        .set('Cookie', adminCookie)
        .send(searchData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should allow global_admin to bulk create/update settings', async () => {
      const bulkData = {
        settings: [
          {
            key: 'test.bulk.setting1',
            value: 'bulk-value-1',
            description: 'Bulk test setting 1',
            group_id: 'test-group'
          },
          {
            key: 'test.bulk.setting2',
            value: 'bulk-value-2',
            description: 'Bulk test setting 2',
            group_id: 'test-group'
          }
        ]
      };

      const response = await request(server.server)
        .post('/api/settings/bulk')
        .set('Cookie', adminCookie)
        .send(bulkData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should allow global_admin to delete a setting', async () => {
      const response = await request(server.server)
        .delete('/api/settings/test.bulk.setting1')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    it('should allow global_admin to access health check', async () => {
      const response = await request(server.server)
        .get('/api/settings/health')
        .set('Cookie', adminCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('Global User Access (should be denied)', () => {
    it('should deny global_user access to list all settings', async () => {
      const response = await request(server.server)
        .get('/api/settings')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny global_user access to list categories', async () => {
      const response = await request(server.server)
        .get('/api/settings/categories')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny global_user access to create settings', async () => {
      const settingData = {
        key: 'unauthorized.setting',
        value: 'unauthorized-value',
        description: 'This should fail',
        encrypted: false,
        group_id: 'test-group'
      };

      const response = await request(server.server)
        .post('/api/settings')
        .set('Cookie', userCookie)
        .send(settingData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny global_user access to get specific settings', async () => {
      const response = await request(server.server)
        .get('/api/settings/test.setting.key')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny global_user access to update settings', async () => {
      const updateData = {
        value: 'unauthorized-update',
        description: 'This should fail'
      };

      const response = await request(server.server)
        .put('/api/settings/test.setting.key')
        .set('Cookie', userCookie)
        .send(updateData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny global_user access to get settings by group', async () => {
      const response = await request(server.server)
        .get('/api/settings/group/test-group')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny global_user access to search settings', async () => {
      const searchData = {
        pattern: 'test'
      };

      const response = await request(server.server)
        .post('/api/settings/search')
        .set('Cookie', userCookie)
        .send(searchData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny global_user access to bulk operations', async () => {
      const bulkData = {
        settings: [
          {
            key: 'unauthorized.bulk.setting',
            value: 'unauthorized-value',
            group_id: 'test-group'
          }
        ]
      };

      const response = await request(server.server)
        .post('/api/settings/bulk')
        .set('Cookie', userCookie)
        .send(bulkData);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny global_user access to delete settings', async () => {
      const response = await request(server.server)
        .delete('/api/settings/test.setting.key')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny global_user access to health check', async () => {
      const response = await request(server.server)
        .get('/api/settings/health')
        .set('Cookie', userCookie);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Unauthenticated Access (should be denied)', () => {
    it('should deny unauthenticated access to list settings', async () => {
      const response = await request(server.server)
        .get('/api/settings');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should deny unauthenticated access to create settings', async () => {
      const settingData = {
        key: 'unauthenticated.setting',
        value: 'unauthenticated-value'
      };

      const response = await request(server.server)
        .post('/api/settings')
        .send(settingData);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
});
