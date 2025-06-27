import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext';

describe('Admin User Teams Access E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should login admin_user to get fresh session for admin tests', async () => {
    const context = getTestContext();
    
    // Login with the admin user (global_admin) from test 2
    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'admin@example.com',
        password: 'SecurePassword123!'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.user.id).toBe(context.firstUserId);
    expect(loginResponse.body.user.role_id).toBe('global_admin');
    
    // Store fresh session cookie for admin tests
    updateTestContext({
      adminUserTeamsAccessCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should login regular_user to get fresh session for permission tests', async () => {
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
    
    // Store fresh session cookie for regular user tests
    updateTestContext({
      regularUserTeamsAccessCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should allow admin to access their own teams via admin endpoint', async () => {
    const context = getTestContext();
    
    // Admin accessing their own teams via admin endpoint
    const response = await request(server.server)
      .get(`/api/users/${context.firstUserId}/teams`)
      .set('Cookie', context.adminUserTeamsAccessCookie!);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('teams');
    expect(Array.isArray(response.body.teams)).toBe(true);
    expect(response.body.teams.length).toBeGreaterThan(0);
    
    // Verify team data structure includes role and ownership information
    const team = response.body.teams[0];
    expect(team).toHaveProperty('id');
    expect(team).toHaveProperty('name');
    expect(team).toHaveProperty('slug');
    expect(team).toHaveProperty('description');
    expect(team).toHaveProperty('owner_id');
    expect(team).toHaveProperty('created_at');
    expect(team).toHaveProperty('updated_at');
    expect(team).toHaveProperty('role');
    expect(team).toHaveProperty('is_owner');
    
    // Verify admin is owner of their default team
    const defaultTeam = response.body.teams.find((t: any) => t.name === 'admin_user');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.owner_id).toBe(context.firstUserId);
    expect(defaultTeam.is_owner).toBe(true);
    expect(defaultTeam.role).toBe('team_admin');
  });

  it('should allow admin to access regular user teams via admin endpoint', async () => {
    const context = getTestContext();
    
    // Admin accessing regular user's teams via admin endpoint
    const response = await request(server.server)
      .get(`/api/users/${context.secondUserId}/teams`)
      .set('Cookie', context.adminUserTeamsAccessCookie!);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('teams');
    expect(Array.isArray(response.body.teams)).toBe(true);
    expect(response.body.teams.length).toBeGreaterThan(0);
    
    // Verify team data structure
    const team = response.body.teams[0];
    expect(team).toHaveProperty('id');
    expect(team).toHaveProperty('name');
    expect(team).toHaveProperty('slug');
    expect(team).toHaveProperty('description');
    expect(team).toHaveProperty('owner_id');
    expect(team).toHaveProperty('created_at');
    expect(team).toHaveProperty('updated_at');
    expect(team).toHaveProperty('role');
    expect(team).toHaveProperty('is_owner');
    
    // Verify regular user's default team
    const defaultTeam = response.body.teams.find((t: any) => t.name === 'regular_user');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.owner_id).toBe(context.secondUserId);
    expect(defaultTeam.is_owner).toBe(true);
    expect(defaultTeam.role).toBe('team_admin');
    
    // Admin should see all teams that regular user has (from previous tests)
    // Regular user should have at least their default team, possibly more from test 10
    expect(response.body.teams.length).toBeGreaterThanOrEqual(1);
  });

  it('should allow regular user to access their own teams via admin endpoint', async () => {
    const context = getTestContext();
    
    // Regular user accessing their own teams via admin endpoint (self-access allowed)
    const response = await request(server.server)
      .get(`/api/users/${context.secondUserId}/teams`)
      .set('Cookie', context.regularUserTeamsAccessCookie!);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('teams');
    expect(Array.isArray(response.body.teams)).toBe(true);
    expect(response.body.teams.length).toBeGreaterThan(0);
    
    // Verify user can see their own teams with proper data
    const defaultTeam = response.body.teams.find((t: any) => t.name === 'regular_user');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.owner_id).toBe(context.secondUserId);
    expect(defaultTeam.is_owner).toBe(true);
    expect(defaultTeam.role).toBe('team_admin');
  });

  it('should prevent regular user from accessing admin teams via admin endpoint', async () => {
    const context = getTestContext();
    
    // Regular user trying to access admin's teams via admin endpoint
    const response = await request(server.server)
      .get(`/api/users/${context.firstUserId}/teams`)
      .set('Cookie', context.regularUserTeamsAccessCookie!);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.toLowerCase()).toContain('access');
  });

  it('should prevent regular user from accessing another regular user teams via admin endpoint', async () => {
    const context = getTestContext();
    
    // Regular user trying to access third user's teams via admin endpoint
    const response = await request(server.server)
      .get(`/api/users/${context.thirdUserId}/teams`)
      .set('Cookie', context.regularUserTeamsAccessCookie!);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.toLowerCase()).toContain('access');
  });

  it('should allow admin to access third user teams via admin endpoint', async () => {
    const context = getTestContext();
    
    // Admin accessing third user's teams via admin endpoint
    const response = await request(server.server)
      .get(`/api/users/${context.thirdUserId}/teams`)
      .set('Cookie', context.adminUserTeamsAccessCookie!);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('teams');
    expect(Array.isArray(response.body.teams)).toBe(true);
    expect(response.body.teams.length).toBeGreaterThan(0);
    
    // Verify third user's default team
    const defaultTeam = response.body.teams.find((t: any) => t.name === 'regular_user_2');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.owner_id).toBe(context.thirdUserId);
    expect(defaultTeam.is_owner).toBe(true);
    expect(defaultTeam.role).toBe('team_admin');
  });

  it('should return 404 when admin tries to access non-existent user teams', async () => {
    const context = getTestContext();
    
    // Admin trying to access teams for non-existent user
    const response = await request(server.server)
      .get('/api/users/non-existent-user-id/teams')
      .set('Cookie', context.adminUserTeamsAccessCookie!);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.toLowerCase()).toContain('not found');
  });

  it('should return 401 when accessing admin endpoint without authentication', async () => {
    const context = getTestContext();
    
    // Trying to access admin endpoint without authentication
    const response = await request(server.server)
      .get(`/api/users/${context.secondUserId}/teams`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.toLowerCase()).toContain('authentication');
  });

  it('should verify response format matches API specification', async () => {
    const context = getTestContext();
    
    // Get teams via admin endpoint and verify complete response structure
    const response = await request(server.server)
      .get(`/api/users/${context.secondUserId}/teams`)
      .set('Cookie', context.adminUserTeamsAccessCookie!);

    expect(response.status).toBe(200);
    
    // Verify top-level response structure
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('teams');
    expect(Array.isArray(response.body.teams)).toBe(true);
    
    // Verify each team object has all required fields
    response.body.teams.forEach((team: any) => {
      expect(team).toHaveProperty('id');
      expect(typeof team.id).toBe('string');
      
      expect(team).toHaveProperty('name');
      expect(typeof team.name).toBe('string');
      
      expect(team).toHaveProperty('slug');
      expect(typeof team.slug).toBe('string');
      
      expect(team).toHaveProperty('description');
      // description can be string or null
      
      expect(team).toHaveProperty('owner_id');
      expect(typeof team.owner_id).toBe('string');
      
      expect(team).toHaveProperty('created_at');
      expect(typeof team.created_at).toBe('string');
      
      expect(team).toHaveProperty('updated_at');
      expect(typeof team.updated_at).toBe('string');
      
      expect(team).toHaveProperty('role');
      expect(['team_admin', 'team_user']).toContain(team.role);
      
      expect(team).toHaveProperty('is_owner');
      expect(typeof team.is_owner).toBe('boolean');
    });
  });
});
