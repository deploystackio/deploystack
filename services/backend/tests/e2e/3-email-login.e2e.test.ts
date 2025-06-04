import request from 'supertest';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs-extra';
import * as path from 'path';
import { getTestContext, updateTestContext } from './testContext';

// __dirname is services/backend/tests/e2e
const APP_BACKEND_ROOT = path.join(__dirname, '..', '..'); // Resolves to services/backend/
const DB_FILE_PATH = path.join(APP_BACKEND_ROOT, 'database', 'deploystack.test.db'); // Path where the app creates the db

describe('Email Login and Logout E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should login first user (admin) with email and password', async () => {
    // Ensure database and users exist (should be done by previous tests)
    expect(await fs.pathExists(DB_FILE_PATH)).toBe(true);
    const context = getTestContext();
    expect(context.firstUserId).toBeDefined();

    // Login with first user credentials
    const loginData = {
      email: 'admin@example.com',
      password: 'SecurePassword123!'
    };

    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send(loginData);

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('success', true);
    expect(loginResponse.body).toHaveProperty('message');
    expect(loginResponse.body).toHaveProperty('user');
    
    const user = loginResponse.body.user;
    expect(user.id).toBe(context.firstUserId);
    expect(user.email).toBe('admin@example.com');
    expect(user.username).toBe('admin_user');
    expect(user.role_id).toBe('global_admin');
    
    // Verify user has a session cookie
    expect(loginResponse.headers['set-cookie']).toBeDefined();
    
    // Store new session cookie
    updateTestContext({
      firstUserLoginCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should login second user (regular) with email and password', async () => {
    // Ensure second user exists
    const context = getTestContext();
    expect(context.secondUserId).toBeDefined();

    // Login with second user credentials
    const loginData = {
      email: 'user@example.com',
      password: 'SecurePassword456!'
    };

    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send(loginData);

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('success', true);
    expect(loginResponse.body).toHaveProperty('user');
    
    const user = loginResponse.body.user;
    expect(user.id).toBe(context.secondUserId);
    expect(user.email).toBe('user@example.com');
    expect(user.username).toBe('regular_user');
    expect(user.role_id).toBe('global_user');
    
    // Verify user has a session cookie
    expect(loginResponse.headers['set-cookie']).toBeDefined();
    
    // Store new session cookie
    updateTestContext({
      secondUserLoginCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should verify user sessions exist in database after login', async () => {
    // Check that both users have active sessions by making authenticated requests
    const context = getTestContext();
    
    // Test first user session
    const firstUserProfileResponse = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.firstUserLoginCookie!);

    expect(firstUserProfileResponse.status).toBe(200);
    expect(firstUserProfileResponse.body.id).toBe(context.firstUserId);
    expect(firstUserProfileResponse.body.role_id).toBe('global_admin');

    // Test second user session
    const secondUserProfileResponse = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.secondUserLoginCookie!);

    expect(secondUserProfileResponse.status).toBe(200);
    expect(secondUserProfileResponse.body.id).toBe(context.secondUserId);
    expect(secondUserProfileResponse.body.role_id).toBe('global_user');
  });

  it('should reject login with invalid email', async () => {
    const invalidLoginData = {
      email: 'nonexistent@example.com',
      password: 'SecurePassword123!'
    };

    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send(invalidLoginData);

    expect(loginResponse.status).toBe(400);
    expect(loginResponse.body).toHaveProperty('success', false);
    expect(loginResponse.body).toHaveProperty('error');
  });

  it('should reject login with invalid password', async () => {
    const invalidLoginData = {
      email: 'admin@example.com',
      password: 'WrongPassword123!'
    };

    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send(invalidLoginData);

    expect(loginResponse.status).toBe(400);
    expect(loginResponse.body).toHaveProperty('success', false);
    expect(loginResponse.body).toHaveProperty('error');
  });

  it('should logout first user and invalidate session', async () => {
    const context = getTestContext();
    
    // Logout first user
    const logoutResponse = await request(server.server)
      .post('/api/auth/logout')
      .set('Cookie', context.firstUserLoginCookie!);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toHaveProperty('success', true);
    expect(logoutResponse.body).toHaveProperty('message');

    // Verify session is invalidated by trying to access protected route
    const profileResponse = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.firstUserLoginCookie!);

    expect(profileResponse.status).toBe(401);
  });

  it('should logout second user and invalidate session', async () => {
    const context = getTestContext();
    
    // Logout second user
    const logoutResponse = await request(server.server)
      .post('/api/auth/logout')
      .set('Cookie', context.secondUserLoginCookie!);

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toHaveProperty('success', true);
    expect(logoutResponse.body).toHaveProperty('message');

    // Verify session is invalidated by trying to access protected route
    const profileResponse = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.secondUserLoginCookie!);

    expect(profileResponse.status).toBe(401);
  });

  it('should verify no active sessions remain after logout', async () => {
    const context = getTestContext();
    
    // Try to access protected routes with both old cookies
    const firstUserResponse = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.firstUserLoginCookie!);

    expect(firstUserResponse.status).toBe(401);

    const secondUserResponse = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.secondUserLoginCookie!);

    expect(secondUserResponse.status).toBe(401);
  });

  it('should handle logout without valid session gracefully', async () => {
    // Try to logout without a valid session
    const logoutResponse = await request(server.server)
      .post('/api/auth/logout');

    // Should handle gracefully (either 200 or 401, depending on implementation)
    expect([200, 401]).toContain(logoutResponse.status);
  });

  it('should allow re-login after logout', async () => {
    const context = getTestContext();
    
    // Re-login with first user after logout
    const loginData = {
      email: 'admin@example.com',
      password: 'SecurePassword123!'
    };

    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send(loginData);

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body).toHaveProperty('success', true);
    expect(loginResponse.body.user.id).toBe(context.firstUserId);
    
    // Verify new session works
    const newCookie = loginResponse.headers['set-cookie'][0];
    const profileResponse = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', newCookie);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.id).toBe(context.firstUserId);
  });
});
