import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext';

describe('Team Visibility E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should login both users to get fresh sessions for visibility testing', async () => {
    const context = getTestContext();
    
    // Login admin user (first user)
    const adminLoginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'admin@example.com',
        password: 'SecurePassword123!'
      });

    expect(adminLoginResponse.status).toBe(200);
    expect(adminLoginResponse.body.success).toBe(true);
    expect(adminLoginResponse.body.user.id).toBe(context.firstUserId);
    expect(adminLoginResponse.body.user.role_id).toBe('global_admin');
    
    // Login regular user (second user)
    const userLoginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'user@example.com',
        password: 'SecurePassword456!'
      });

    expect(userLoginResponse.status).toBe(200);
    expect(userLoginResponse.body.success).toBe(true);
    expect(userLoginResponse.body.user.id).toBe(context.secondUserId);
    expect(userLoginResponse.body.user.role_id).toBe('global_user');
    
    // Store fresh session cookies for visibility tests
    updateTestContext({
      firstUserVisibilityCookie: adminLoginResponse.headers['set-cookie'][0],
      secondUserVisibilityCookie: userLoginResponse.headers['set-cookie'][0]
    });
  });

  it('should show only admin user teams when admin calls /api/teams/me', async () => {
    const context = getTestContext();
    
    // Get admin user's teams
    const adminTeamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.firstUserVisibilityCookie!);

    expect(adminTeamsResponse.status).toBe(200);
    expect(adminTeamsResponse.body).toHaveProperty('success', true);
    expect(adminTeamsResponse.body).toHaveProperty('data');
    expect(Array.isArray(adminTeamsResponse.body.data)).toBe(true);
    
    const adminTeams = adminTeamsResponse.body.data;
    
    // Admin should have exactly 1 team (their default team)
    expect(adminTeams).toHaveLength(1);
    
    // Verify all teams belong to admin user
    adminTeams.forEach((team: any) => {
      expect(team.owner_id).toBe(context.firstUserId);
      expect(team.role).toBe('team_admin'); // User is admin of their own teams
    });
    
    // Verify admin's default team
    const adminDefaultTeam = adminTeams[0];
    expect(adminDefaultTeam.name).toBe('admin_user'); // Default team name is username
    expect(adminDefaultTeam.owner_id).toBe(context.firstUserId);
    
    // Store admin team info for cross-verification
    updateTestContext({
      firstUserDefaultTeamId: adminDefaultTeam.id
    });
  });

  it('should show only regular user teams when regular user calls /api/teams/me', async () => {
    const context = getTestContext();
    
    // Get regular user's teams
    const userTeamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserVisibilityCookie!);

    expect(userTeamsResponse.status).toBe(200);
    expect(userTeamsResponse.body).toHaveProperty('success', true);
    expect(userTeamsResponse.body).toHaveProperty('data');
    expect(Array.isArray(userTeamsResponse.body.data)).toBe(true);
    
    const userTeams = userTeamsResponse.body.data;
    
    // Regular user should have exactly 3 teams (from previous test)
    expect(userTeams).toHaveLength(3);
    
    // Verify all teams belong to regular user
    userTeams.forEach((team: any) => {
      expect(team.owner_id).toBe(context.secondUserId);
      expect(team.role).toBe('team_admin'); // User is admin of their own teams
    });
    
    // Verify team names
    const teamNames = userTeams.map((team: any) => team.name).sort();
    expect(teamNames).toEqual(['Additional Team 1', 'Additional Team 2', 'regular_user']);
    
    // Verify none of the teams belong to admin user
    userTeams.forEach((team: any) => {
      expect(team.owner_id).not.toBe(context.firstUserId);
    });
  });

  it('should verify admin user cannot see regular user teams', async () => {
    const context = getTestContext();
    
    // Get admin user's teams again
    const adminTeamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.firstUserVisibilityCookie!);

    expect(adminTeamsResponse.status).toBe(200);
    const adminTeams = adminTeamsResponse.body.data;
    
    // Admin should still have only 1 team
    expect(adminTeams).toHaveLength(1);
    
    // Verify admin doesn't see any of the regular user's teams
    const adminTeamNames = adminTeams.map((team: any) => team.name);
    expect(adminTeamNames).not.toContain('Additional Team 1');
    expect(adminTeamNames).not.toContain('Additional Team 2');
    expect(adminTeamNames).not.toContain('regular_user'); // This is the regular user's default team name
    
    // Admin should only see their own default team
    expect(adminTeamNames).toContain('admin_user');
  });

  it('should verify regular user cannot see admin user teams', async () => {
    const context = getTestContext();
    
    // Get regular user's teams again
    const userTeamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserVisibilityCookie!);

    expect(userTeamsResponse.status).toBe(200);
    const userTeams = userTeamsResponse.body.data;
    
    // Regular user should still have 3 teams
    expect(userTeams).toHaveLength(3);
    
    // Verify regular user doesn't see admin's team
    const userTeamNames = userTeams.map((team: any) => team.name);
    expect(userTeamNames).not.toContain('admin_user'); // This is the admin's default team name
    
    // Regular user should only see their own teams
    expect(userTeamNames).toContain('Additional Team 1');
    expect(userTeamNames).toContain('Additional Team 2');
    expect(userTeamNames).toContain('regular_user');
  });

  it('should verify team ownership consistency', async () => {
    const context = getTestContext();
    
    // Get both users' teams
    const adminTeamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.firstUserVisibilityCookie!);
    
    const userTeamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserVisibilityCookie!);

    expect(adminTeamsResponse.status).toBe(200);
    expect(userTeamsResponse.status).toBe(200);
    
    const adminTeams = adminTeamsResponse.body.data;
    const userTeams = userTeamsResponse.body.data;
    
    // Verify admin teams ownership
    adminTeams.forEach((team: any) => {
      expect(team.owner_id).toBe(context.firstUserId);
      expect(team.role).toBe('team_admin');
    });
    
    // Verify regular user teams ownership
    userTeams.forEach((team: any) => {
      expect(team.owner_id).toBe(context.secondUserId);
      expect(team.role).toBe('team_admin');
    });
    
    // Verify no team ID overlap between users
    const adminTeamIds = adminTeams.map((team: any) => team.id);
    const userTeamIds = userTeams.map((team: any) => team.id);
    
    adminTeamIds.forEach((adminTeamId: string) => {
      expect(userTeamIds).not.toContain(adminTeamId);
    });
    
    userTeamIds.forEach((userTeamId: string) => {
      expect(adminTeamIds).not.toContain(userTeamId);
    });
  });

  it('should require authentication for /api/teams/me endpoint', async () => {
    // Try to access teams without authentication
    const response = await request(server.server)
      .get('/api/teams/me');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });

  it('should reject requests with invalid session cookies', async () => {
    // Try to access teams with invalid cookie
    const response = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', 'auth_session=invalid_session_token');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });

  it('should verify team data structure and required fields', async () => {
    const context = getTestContext();
    
    // Get regular user's teams (they have more teams to test with)
    const userTeamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserVisibilityCookie!);

    expect(userTeamsResponse.status).toBe(200);
    const userTeams = userTeamsResponse.body.data;
    
    // Verify each team has required fields
    userTeams.forEach((team: any) => {
      expect(team).toHaveProperty('id');
      expect(team).toHaveProperty('name');
      expect(team).toHaveProperty('slug');
      expect(team).toHaveProperty('description');
      expect(team).toHaveProperty('owner_id');
      expect(team).toHaveProperty('created_at');
      expect(team).toHaveProperty('updated_at');
      expect(team).toHaveProperty('role');
      
      // Verify field types
      expect(typeof team.id).toBe('string');
      expect(typeof team.name).toBe('string');
      expect(typeof team.slug).toBe('string');
      expect(typeof team.owner_id).toBe('string');
      expect(typeof team.created_at).toBe('string');
      expect(typeof team.updated_at).toBe('string');
      expect(typeof team.role).toBe('string');
      
      // Verify role is valid
      expect(['team_admin', 'team_user']).toContain(team.role);
      
      // Verify dates are valid ISO strings
      expect(new Date(team.created_at).toISOString()).toBe(team.created_at);
      expect(new Date(team.updated_at).toISOString()).toBe(team.updated_at);
    });
  });
});
