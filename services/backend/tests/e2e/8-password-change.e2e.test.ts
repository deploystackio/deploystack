import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext';

describe('Password Change E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should login regular user to get fresh session for password change', async () => {
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
    
    // Store fresh session cookie for password change tests
    updateTestContext({
      secondUserLoginCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should successfully change password of regular user', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/email/change-password')
      .set('Cookie', context.secondUserLoginCookie!)
      .send({
        current_password: 'SecurePassword456!',
        new_password: 'NewSecurePassword789!'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Password changed successfully.');
  });

  it('should be able to login with new password', async () => {
    const response = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'user@example.com',
        password: 'NewSecurePassword789!'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('user@example.com');
    expect(response.body.user.role_id).toBe('global_user');
  });

  it('should not be able to login with old password', async () => {
    const response = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'user@example.com',
        password: 'SecurePassword456!'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Invalid email/username or password.');
  });

  it('should change password back to original for subsequent tests', async () => {
    const context = getTestContext();
    
    // Login with new password to get session
    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'user@example.com',
        password: 'NewSecurePassword789!'
      });

    expect(loginResponse.status).toBe(200);
    const newCookie = loginResponse.headers['set-cookie'][0];

    // Change password back to original
    const changeResponse = await request(server.server)
      .put('/api/auth/email/change-password')
      .set('Cookie', newCookie)
      .send({
        current_password: 'NewSecurePassword789!',
        new_password: 'SecurePassword456!'
      });

    expect(changeResponse.status).toBe(200);
    expect(changeResponse.body.success).toBe(true);
    expect(changeResponse.body.message).toBe('Password changed successfully.');
  });

  it('should be able to login with original password after changing back', async () => {
    const response = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'user@example.com',
        password: 'SecurePassword456!'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe('user@example.com');
    expect(response.body.user.role_id).toBe('global_user');
  });

  it('should reject password change with incorrect current password', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/email/change-password')
      .set('Cookie', context.secondUserLoginCookie!)
      .send({
        current_password: 'wrongpassword',
        new_password: 'anothernewpassword'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Current password is incorrect.');
  });

  it('should reject password change when new password is same as current', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/email/change-password')
      .set('Cookie', context.secondUserLoginCookie!)
      .send({
        current_password: 'SecurePassword456!',
        new_password: 'SecurePassword456!'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('New password must be different from current password.');
  });

  it('should reject password change without authentication', async () => {
    const response = await request(server.server)
      .put('/api/auth/email/change-password')
      .send({
        current_password: 'SecurePassword456!',
        new_password: 'finalpassword789'
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Unauthorized: Authentication required.');
  });

  it('should reject password change with invalid new password (too short)', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .put('/api/auth/email/change-password')
      .set('Cookie', context.secondUserLoginCookie!)
      .send({
        current_password: 'SecurePassword456!',
        new_password: '123'
      });

    expect(response.status).toBe(400);
    // This should be caught by the schema validation
  });
});
