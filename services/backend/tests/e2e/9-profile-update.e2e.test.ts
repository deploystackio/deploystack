import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext';

describe('Profile Update E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should login regular user to get fresh session for profile update', async () => {
    const context = getTestContext();
    
    // Login with the regular user (global_user) from test 2
    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'user@example.com',
        password: 'SecurePassword456!'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.user.id).toBe(context.secondUserId);
    expect(loginResponse.body.user.role_id).toBe('global_user');
    
    // Store fresh session cookie for profile update tests
    updateTestContext({
      secondUserProfileCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should get current user profile to verify initial state', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.secondUserProfileCookie!);

    expect(response.status).toBe(200);
    expect(response.body.username).toBe('regular_user');
    expect(response.body.first_name).toBe('Regular');
    expect(response.body.last_name).toBe('User');
    expect(response.body.email).toBe('user@example.com');
    expect(response.body.role_id).toBe('global_user');
  });

  it('should successfully update first_name and last_name', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({
        first_name: 'Updated Regular',
        last_name: 'Updated User'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Profile updated successfully.');
    expect(response.body.user).toBeDefined();
    expect(response.body.user.first_name).toBe('Updated Regular');
    expect(response.body.user.last_name).toBe('Updated User');
    expect(response.body.user.username).toBe('regular_user'); // Should remain unchanged
    expect(response.body.user.email).toBe('user@example.com'); // Should remain unchanged
  });

  it('should verify profile changes via /api/users/me', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.secondUserProfileCookie!);

    expect(response.status).toBe(200);
    expect(response.body.first_name).toBe('Updated Regular');
    expect(response.body.last_name).toBe('Updated User');
    expect(response.body.username).toBe('regular_user');
    expect(response.body.email).toBe('user@example.com');
  });

  it('should successfully update username', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({
        username: 'updated_user'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.username).toBe('updated_user');
    expect(response.body.user.first_name).toBe('Updated Regular'); // Should remain unchanged
    expect(response.body.user.last_name).toBe('Updated User'); // Should remain unchanged
  });

  it('should verify username change via /api/users/me', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.secondUserProfileCookie!);

    expect(response.status).toBe(200);
    expect(response.body.username).toBe('updated_user');
    expect(response.body.first_name).toBe('Updated Regular');
    expect(response.body.last_name).toBe('Updated User');
  });

  it('should successfully update only first_name (partial update)', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({
        first_name: 'Final Name'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.first_name).toBe('Final Name');
    expect(response.body.user.last_name).toBe('Updated User'); // Should remain unchanged
    expect(response.body.user.username).toBe('updated_user'); // Should remain unchanged
  });

  it('should reject profile update with no fields provided', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('At least one field (username, first_name, or last_name) must be provided.');
  });

  it('should reject profile update with username already taken', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({
        username: 'admin_user' // This username is taken by the first user
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Username is already taken.');
  });

  it('should reject profile update without authentication', async () => {
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .send({
        first_name: 'Unauthorized',
        last_name: 'Update'
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Unauthorized: Authentication required.');
  });

  it('should reject profile update with invalid username (too short)', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({
        username: 'ab' // Too short (minimum 3 characters)
      });

    expect(response.status).toBe(400);
    // This should be caught by the schema validation
  });

  it('should reject profile update with invalid username pattern', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({
        username: 'invalid-username!' // Contains invalid characters
      });

    expect(response.status).toBe(400);
    // This should be caught by the schema validation
  });

  it('should reject profile update with first_name too long', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({
        first_name: 'a'.repeat(51) // Too long (maximum 50 characters)
      });

    expect(response.status).toBe(400);
    // This should be caught by the schema validation
  });

  it('should reject profile update with last_name too long', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({
        last_name: 'a'.repeat(51) // Too long (maximum 50 characters)
      });

    expect(response.status).toBe(400);
    // This should be caught by the schema validation
  });

  it('should restore original profile values for subsequent tests', async () => {
    const context = getTestContext();
    
    // Restore to original values to maintain test chain integrity
    const response = await request(server.server)
      .put('/api/auth/profile/update')
      .set('Cookie', context.secondUserProfileCookie!)
      .send({
        username: 'regular_user',
        first_name: 'Regular',
        last_name: 'User'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.username).toBe('regular_user');
    expect(response.body.user.first_name).toBe('Regular');
    expect(response.body.user.last_name).toBe('User');
  });

  it('should verify profile restoration via /api/users/me', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .get('/api/users/me')
      .set('Cookie', context.secondUserProfileCookie!);

    expect(response.status).toBe(200);
    expect(response.body.username).toBe('regular_user');
    expect(response.body.first_name).toBe('Regular');
    expect(response.body.last_name).toBe('User');
    expect(response.body.email).toBe('user@example.com');
    expect(response.body.role_id).toBe('global_user');
  });
});
