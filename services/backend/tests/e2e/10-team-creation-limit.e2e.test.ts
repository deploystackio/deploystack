import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext';

describe('Team Creation and Limit E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should login regular user to get fresh session for team creation', async () => {
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
    
    // Store fresh session cookie for team creation tests
    updateTestContext({
      secondUserTeamCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should verify user starts with 1 default team', async () => {
    const context = getTestContext();
    
    // Check user's current teams
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserTeamCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body).toHaveProperty('data');
    expect(teamsResponse.body.data).toHaveLength(1);
    
    const defaultTeam = teamsResponse.body.data[0];
    expect(defaultTeam.name).toBe('regular_user'); // Default team name is username
    expect(defaultTeam.owner_id).toBe(context.secondUserId);
    expect(defaultTeam.role).toBe('team_admin'); // User is admin of their own team
    
    // Store default team ID for reference
    updateTestContext({
      secondUserDefaultTeamId: defaultTeam.id
    });
  });

  it('should successfully create first additional team (total: 2 teams)', async () => {
    const context = getTestContext();
    
    const teamData = {
      name: 'Additional Team 1',
      description: 'First additional team for testing'
    };

    const response = await request(server.server)
      .post('/api/teams')
      .set('Cookie', context.secondUserTeamCookie!)
      .send(teamData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('message');
    
    const team = response.body.data;
    expect(team.name).toBe(teamData.name);
    expect(team.description).toBe(teamData.description);
    expect(team.owner_id).toBe(context.secondUserId);
    expect(team.slug).toBe('additional-team-1'); // Auto-generated slug
    expect(team.id).toBeDefined();
    expect(team.created_at).toBeDefined();
    expect(team.updated_at).toBeDefined();
    
    // Store team ID for reference
    updateTestContext({
      secondUserTeam1Id: team.id
    });
  });

  it('should successfully create second additional team (total: 3 teams)', async () => {
    const context = getTestContext();
    
    const teamData = {
      name: 'Additional Team 2',
      description: 'Second additional team for testing'
    };

    const response = await request(server.server)
      .post('/api/teams')
      .set('Cookie', context.secondUserTeamCookie!)
      .send(teamData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    
    const team = response.body.data;
    expect(team.name).toBe(teamData.name);
    expect(team.description).toBe(teamData.description);
    expect(team.owner_id).toBe(context.secondUserId);
    expect(team.slug).toBe('additional-team-2'); // Auto-generated slug
    
    // Store team ID for reference
    updateTestContext({
      secondUserTeam2Id: team.id
    });
  });

  it('should verify user now has exactly 3 teams', async () => {
    const context = getTestContext();
    
    // Check user's current teams
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserTeamCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body).toHaveProperty('data');
    expect(teamsResponse.body.data).toHaveLength(3);
    
    // Verify all teams belong to the user
    const teams = teamsResponse.body.data;
    teams.forEach((team: any) => {
      expect(team.owner_id).toBe(context.secondUserId);
      expect(team.role).toBe('team_admin'); // User is admin of their own teams
    });
    
    // Verify team names
    const teamNames = teams.map((team: any) => team.name).sort();
    expect(teamNames).toEqual(['Additional Team 1', 'Additional Team 2', 'regular_user']);
  });

  it('should fail to create fourth team due to 3-team limit', async () => {
    const context = getTestContext();
    
    const teamData = {
      name: 'Additional Team 3',
      description: 'This team should not be created due to limit'
    };

    const response = await request(server.server)
      .post('/api/teams')
      .set('Cookie', context.secondUserTeamCookie!)
      .send(teamData);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('3'); // Error message should mention the limit
    expect(response.body.error.toLowerCase()).toContain('team'); // Error should be about teams
  });

  it('should still have exactly 3 teams after failed creation attempt', async () => {
    const context = getTestContext();
    
    // Verify the failed attempt didn't create a team
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserTeamCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body.data).toHaveLength(3);
    
    // Verify team names are still the same
    const teams = teamsResponse.body.data;
    const teamNames = teams.map((team: any) => team.name).sort();
    expect(teamNames).toEqual(['Additional Team 1', 'Additional Team 2', 'regular_user']);
  });

  it('should reject team creation with invalid data', async () => {
    const context = getTestContext();
    
    // Test with empty name
    const invalidTeamData = {
      name: '',
      description: 'Team with empty name'
    };

    const response = await request(server.server)
      .post('/api/teams')
      .set('Cookie', context.secondUserTeamCookie!)
      .send(invalidTeamData);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });

  it('should reject team creation without authentication', async () => {
    const teamData = {
      name: 'Unauthorized Team',
      description: 'This should fail without auth'
    };

    const response = await request(server.server)
      .post('/api/teams')
      .send(teamData);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });
});
