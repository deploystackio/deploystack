import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext'; // Assuming updateTestContext might be needed if we were to store new cookies, though not strictly for this test's core logic.

describe('Global Enable Login E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;
  let adminCookie: string | undefined;

  // User credentials (matching those in 2-user-registration.e2e.test.ts and 3-email-login.e2e.test.ts)
  const adminUserCredentials = {
    login: 'admin@example.com',
    password: 'SecurePassword123!',
  };
  const regularUserCredentials = {
    login: 'user@example.com',
    password: 'SecurePassword456!',
  };

  beforeAll(async () => {
    const context = getTestContext();
    server = context.server!;
    port = context.port;

    // Always perform a fresh login for the admin user for this test suite
    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send(adminUserCredentials);

    if (loginResponse.status === 200 && loginResponse.headers['set-cookie']) {
      adminCookie = loginResponse.headers['set-cookie'][0];
      // Optionally update test context if this cookie should be available to subsequent, separate test files,
      // but for this suite, the local adminCookie is sufficient.
      // updateTestContext({ firstUserLoginCookie: adminCookie }); 
    } else {
      console.error('Failed to log in admin user in beforeAll for 7-global-enable-login tests:', loginResponse.body);
      throw new Error('Admin user login failed in beforeAll, cannot proceed with tests for 7-global-enable-login.');
    }
    
    if (!adminCookie) {
        throw new Error('Admin cookie could not be obtained in beforeAll for 7-global-enable-login.');
    }

    // Initial state: ensure login is enabled before starting tests in this suite
    // This also serves as a check that setEnableLogin works with true using the fresh cookie
    await setEnableLogin(true, adminCookie);
  });

  afterAll(async () => {
    // Cleanup: Ensure global.enable_login is set back to true after all tests in this suite
    if (adminCookie) {
      try {
        await setEnableLogin(true, adminCookie);
        console.log('Successfully reset global.enable_login to true in afterAll.');
      } catch (error) {
        console.error('Failed to reset global.enable_login in afterAll:', error);
      }
    }
  });

  // Helper function to set the global.enable_login setting
  async function setEnableLogin(enable: boolean, cookie: string) {
    const response = await request(server.server)
      .put('/api/settings/global.enable_login')
      .set('Cookie', cookie)
      .send({ value: enable.toString(), group_id: 'global' }); // value must be a string

    expect(response.status).toBe(200); // Assuming 200 OK for successful setting update
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('key', 'global.enable_login');
    expect(response.body.data).toHaveProperty('value', enable.toString());
    return response;
  }

  it('should allow login when global.enable_login is true', async () => {
    // Ensure setting is true (might be redundant due to beforeAll/previous test, but good for test isolation)
    await setEnableLogin(true, adminCookie!);

    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send(regularUserCredentials);

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('success', true);
    expect(loginResponse.body.user.email).toBe(regularUserCredentials.login); // Ensure we check against the correct field if it was 'email' before
  });

  it('should prevent login when global.enable_login is set to false', async () => {
    // Set global.enable_login to false
    await setEnableLogin(false, adminCookie!);

    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send(regularUserCredentials);

    expect(loginResponse.status).toBe(403);
    expect(loginResponse.body).toHaveProperty('success', false);
    expect(loginResponse.body.error).toBe('Login is currently disabled by administrator.');
  });

  it('should allow login again when global.enable_login is set back to true', async () => {
    // Set global.enable_login back to true
    await setEnableLogin(true, adminCookie!);

    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send(regularUserCredentials);

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('success', true);
    expect(loginResponse.body.user.email).toBe(regularUserCredentials.login);
  });
});
