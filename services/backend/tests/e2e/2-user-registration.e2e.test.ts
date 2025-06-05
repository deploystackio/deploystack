import request from 'supertest';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs-extra';
import * as path from 'path';
import { getTestContext, updateTestContext } from './testContext';

// __dirname is services/backend/tests/e2e
const TEST_DATA_DIR = path.join(__dirname, 'test-data'); // Resolves to services/backend/tests/e2e/test-data
const DB_FILE_PATH = path.join(TEST_DATA_DIR, 'deploystack.test.db'); // Path where the app creates the test db

describe('User Registration E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should register first user and assign global_admin role', async () => {
    // Ensure database is set up (should be done by setup.e2e.test.ts)
    expect(await fs.pathExists(DB_FILE_PATH)).toBe(true);

    // Register the first user
    const firstUserData = {
      username: 'admin_user',
      email: 'admin@example.com',
      password: 'SecurePassword123!',
      first_name: 'Admin',
      last_name: 'User'
    };

    const registerResponse = await request(server.server)
      .post('/api/auth/email/register')
      .send(firstUserData);

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body).toHaveProperty('success', true);
    expect(registerResponse.body).toHaveProperty('message');
    expect(registerResponse.body).toHaveProperty('user');
    
    const user = registerResponse.body.user;
    expect(user.username).toBe(firstUserData.username);
    expect(user.email).toBe(firstUserData.email);
    expect(user.first_name).toBe(firstUserData.first_name);
    expect(user.last_name).toBe(firstUserData.last_name);
    
    // Verify the first user gets global_admin role
    expect(user.role_id).toBe('global_admin');
    
    // Verify user has a session cookie
    expect(registerResponse.headers['set-cookie']).toBeDefined();
    
    // Store user ID for later tests
    updateTestContext({
      firstUserId: user.id,
      firstUserCookie: registerResponse.headers['set-cookie'][0]
    });
    // SMTP settings are now expected to be set by default in test env via src/global-settings/smtp.ts
  });

  it('should register second user and assign global_user role', async () => {
    // Register the second user
    const secondUserData = {
      username: 'regular_user',
      email: 'user@example.com',
      password: 'SecurePassword456!',
      first_name: 'Regular',
      last_name: 'User'
    };

    const registerResponse = await request(server.server)
      .post('/api/auth/email/register')
      .send(secondUserData);

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body).toHaveProperty('success', true);
    expect(registerResponse.body).toHaveProperty('user');
    
    const user = registerResponse.body.user;
    expect(user.username).toBe(secondUserData.username);
    expect(user.email).toBe(secondUserData.email);
    expect(user.first_name).toBe(secondUserData.first_name);
    expect(user.last_name).toBe(secondUserData.last_name);
    
    // Verify the second user gets global_user role (not admin)
    expect(user.role_id).toBe('global_user');
    
    // Verify user has a session cookie
    expect(registerResponse.headers['set-cookie']).toBeDefined();
    
    // Store user ID for later tests
    updateTestContext({
      secondUserId: user.id,
      secondUserCookie: registerResponse.headers['set-cookie'][0]
    });
  });

  it('should verify both users exist in database with correct roles', async () => {
    const context = getTestContext();
    
    // Get first user details
    const firstUserResponse = await request(server.server)
      .get(`/api/users/${context.firstUserId}`)
      .set('Cookie', context.firstUserCookie!);

    expect(firstUserResponse.status).toBe(200);
    expect(firstUserResponse.body.role_id).toBe('global_admin');

    // Get second user details (using admin privileges)
    const secondUserResponse = await request(server.server)
      .get(`/api/users/${context.secondUserId}`)
      .set('Cookie', context.firstUserCookie!); // Use admin cookie

    expect(secondUserResponse.status).toBe(200);
    expect(secondUserResponse.body.role_id).toBe('global_user');
  });

  it('should create default teams for both users', async () => {
    const context = getTestContext();
    
    // Check first user's teams
    const firstUserTeamsResponse = await request(server.server)
      .get('/api/users/me/teams')
      .set('Cookie', context.firstUserCookie!);

    expect(firstUserTeamsResponse.status).toBe(200);
    expect(firstUserTeamsResponse.body).toHaveProperty('teams');
    expect(firstUserTeamsResponse.body.teams).toHaveLength(1);
    
    const firstUserTeam = firstUserTeamsResponse.body.teams[0];
    expect(firstUserTeam.name).toBe('admin_user'); // Default team name is username
    expect(firstUserTeam.owner_id).toBe(context.firstUserId);

    // Check second user's teams
    const secondUserTeamsResponse = await request(server.server)
      .get('/api/users/me/teams')
      .set('Cookie', context.secondUserCookie!);

    expect(secondUserTeamsResponse.status).toBe(200);
    expect(secondUserTeamsResponse.body).toHaveProperty('teams');
    expect(secondUserTeamsResponse.body.teams).toHaveLength(1);
    
    const secondUserTeam = secondUserTeamsResponse.body.teams[0];
    expect(secondUserTeam.name).toBe('regular_user'); // Default team name is username
    expect(secondUserTeam.owner_id).toBe(context.secondUserId);
  });

  it('should prevent duplicate email registration', async () => {
    const duplicateEmailData = {
      username: 'different_user',
      email: 'admin@example.com', // Same email as first user
      password: 'AnotherPassword789!',
      first_name: 'Different',
      last_name: 'User'
    };

    const registerResponse = await request(server.server)
      .post('/api/auth/email/register')
      .send(duplicateEmailData);

    expect(registerResponse.status).toBe(400);
    expect(registerResponse.body).toHaveProperty('success', false);
    expect(registerResponse.body).toHaveProperty('error');
  });

  it('should prevent duplicate username registration', async () => {
    const duplicateUsernameData = {
      username: 'admin_user', // Same username as first user
      email: 'different@example.com',
      password: 'AnotherPassword789!',
      first_name: 'Different',
      last_name: 'User'
    };

    const registerResponse = await request(server.server)
      .post('/api/auth/email/register')
      .send(duplicateUsernameData);

    expect(registerResponse.status).toBe(400);
    expect(registerResponse.body).toHaveProperty('success', false);
    expect(registerResponse.body).toHaveProperty('error');
  });
});
