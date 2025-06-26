import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext';

describe('Team Cross-User Permissions E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should login regular_user to get fresh session for team creation', async () => {
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
      secondUserCrossPermissionCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should login regular_user_2 to get fresh session', async () => {
    const context = getTestContext();
    
    // Login with the third user (global_user) from test 2
    const loginResponse = await request(server.server)
      .post('/api/auth/email/login')
      .send({
        login: 'user2@example.com',
        password: 'SecurePassword789!'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    expect(loginResponse.body.user.id).toBe(context.thirdUserId);
    expect(loginResponse.body.user.role_id).toBe('global_user');
    
    // Store fresh session cookie for cross-user tests
    updateTestContext({
      thirdUserCrossPermissionCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should verify regular_user has teams from previous tests', async () => {
    const context = getTestContext();
    
    // Check user's current teams (should have 3 teams from test 10: default + 2 additional)
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserCrossPermissionCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body).toHaveProperty('data');
    expect(teamsResponse.body.data).toHaveLength(3); // Default + 2 additional from test 10
    
    const teams = teamsResponse.body.data;
    
    // Find the default team
    const defaultTeam = teams.find((team: any) => team.name === 'regular_user');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.owner_id).toBe(context.secondUserId);
    expect(defaultTeam.role).toBe('team_admin');
    
    // Verify all teams belong to the user
    teams.forEach((team: any) => {
      expect(team.owner_id).toBe(context.secondUserId);
      expect(team.role).toBe('team_admin');
    });
  });

  it('should verify regular_user_2 starts with only default team', async () => {
    const context = getTestContext();
    
    // Check user's current teams
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.thirdUserCrossPermissionCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body).toHaveProperty('data');
    expect(teamsResponse.body.data).toHaveLength(1);
    
    const defaultTeam = teamsResponse.body.data[0];
    expect(defaultTeam.name).toBe('regular_user_2'); // Default team name is username
    expect(defaultTeam.owner_id).toBe(context.thirdUserId);
    expect(defaultTeam.role).toBe('team_admin'); // User is admin of their own team
  });

  it('should delete one existing team to make room for cross-permission test', async () => {
    const context = getTestContext();
    
    // Get current teams to find one to delete (not the default team)
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserCrossPermissionCookie!);

    expect(teamsResponse.status).toBe(200);
    const teams = teamsResponse.body.data;
    
    // Find a non-default team to delete
    const teamToDelete = teams.find((team: any) => team.name !== 'regular_user');
    expect(teamToDelete).toBeDefined();
    
    // Delete the team to make room for our test
    const deleteResponse = await request(server.server)
      .delete(`/api/teams/${teamToDelete.id}`)
      .set('Cookie', context.secondUserCrossPermissionCookie!);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toHaveProperty('success', true);
  });

  it('should allow regular_user to create a new team', async () => {
    const context = getTestContext();
    
    const teamData = {
      name: 'Cross Permission Test Team',
      description: 'Team created by regular_user for cross-permission testing'
    };

    const response = await request(server.server)
      .post('/api/teams')
      .set('Cookie', context.secondUserCrossPermissionCookie!)
      .send(teamData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('message');
    
    const team = response.body.data;
    expect(team.name).toBe(teamData.name);
    expect(team.description).toBe(teamData.description);
    expect(team.owner_id).toBe(context.secondUserId);
    expect(team.slug).toBe('cross-permission-test-team'); // Auto-generated slug
    expect(team.id).toBeDefined();
    expect(team.created_at).toBeDefined();
    expect(team.updated_at).toBeDefined();
    
    // Store team ID for cross-user permission tests
    updateTestContext({
      crossPermissionTestTeamId: team.id
    });
  });

  it('should verify regular_user now has 3 teams', async () => {
    const context = getTestContext();
    
    // Check user's current teams (should have 3: default + 1 remaining from test 10 + new test team)
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserCrossPermissionCookie!);

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
    
    // Verify the new test team exists
    const testTeam = teams.find((team: any) => team.name === 'Cross Permission Test Team');
    expect(testTeam).toBeDefined();
    expect(testTeam.id).toBe(context.crossPermissionTestTeamId);
  });

  it('should prevent regular_user_2 from accessing regular_user team by ID', async () => {
    const context = getTestContext();
    
    // Try to get the team created by regular_user using regular_user_2's session
    const response = await request(server.server)
      .get(`/api/teams/${context.crossPermissionTestTeamId}`)
      .set('Cookie', context.thirdUserCrossPermissionCookie!);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.toLowerCase()).toContain('access');
  });

  it('should prevent regular_user_2 from deleting regular_user team', async () => {
    const context = getTestContext();
    
    // Try to delete the team created by regular_user using regular_user_2's session
    const response = await request(server.server)
      .delete(`/api/teams/${context.crossPermissionTestTeamId}`)
      .set('Cookie', context.thirdUserCrossPermissionCookie!);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.toLowerCase()).toContain('owner');
  });

  it('should prevent regular_user_2 from updating regular_user team', async () => {
    const context = getTestContext();
    
    const updateData = {
      name: 'Hacked Team Name',
      description: 'This should not work'
    };

    // Try to update the team created by regular_user using regular_user_2's session
    const response = await request(server.server)
      .put(`/api/teams/${context.crossPermissionTestTeamId}`)
      .set('Cookie', context.thirdUserCrossPermissionCookie!)
      .send(updateData);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.toLowerCase()).toContain('administrator');
  });

  it('should verify regular_user_2 only sees their own teams', async () => {
    const context = getTestContext();
    
    // Check that regular_user_2 only sees their own team
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.thirdUserCrossPermissionCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body).toHaveProperty('data');
    expect(teamsResponse.body.data).toHaveLength(1);
    
    const team = teamsResponse.body.data[0];
    expect(team.name).toBe('regular_user_2'); // Only their default team
    expect(team.owner_id).toBe(context.thirdUserId);
    expect(team.role).toBe('team_admin');
  });

  it('should verify the team created by regular_user still exists and is unchanged', async () => {
    const context = getTestContext();
    
    // Verify regular_user can still access their team
    const teamResponse = await request(server.server)
      .get(`/api/teams/${context.crossPermissionTestTeamId}`)
      .set('Cookie', context.secondUserCrossPermissionCookie!);

    expect(teamResponse.status).toBe(200);
    expect(teamResponse.body).toHaveProperty('success', true);
    expect(teamResponse.body).toHaveProperty('data');
    
    const team = teamResponse.body.data;
    expect(team.name).toBe('Cross Permission Test Team'); // Original name unchanged
    expect(team.description).toBe('Team created by regular_user for cross-permission testing');
    expect(team.owner_id).toBe(context.secondUserId);
    expect(team.slug).toBe('cross-permission-test-team');
  });

  it('should allow regular_user to delete their own team', async () => {
    const context = getTestContext();
    
    // regular_user should be able to delete their own team
    const response = await request(server.server)
      .delete(`/api/teams/${context.crossPermissionTestTeamId}`)
      .set('Cookie', context.secondUserCrossPermissionCookie!);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message');
  });

  it('should verify regular_user has 2 teams after deletion', async () => {
    const context = getTestContext();
    
    // Check user's current teams after deletion (should have 2: default + 1 remaining from test 10)
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserCrossPermissionCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body).toHaveProperty('data');
    expect(teamsResponse.body.data).toHaveLength(2);
    
    const teams = teamsResponse.body.data;
    
    // Verify default team exists
    const defaultTeam = teams.find((team: any) => team.name === 'regular_user');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.owner_id).toBe(context.secondUserId);
    expect(defaultTeam.role).toBe('team_admin');
    
    // Verify the cross-permission test team is gone
    const testTeam = teams.find((team: any) => team.name === 'Cross Permission Test Team');
    expect(testTeam).toBeUndefined();
  });

  it('should return 404 when trying to access deleted team', async () => {
    const context = getTestContext();
    
    // Try to access the deleted team
    const response = await request(server.server)
      .get(`/api/teams/${context.crossPermissionTestTeamId}`)
      .set('Cookie', context.secondUserCrossPermissionCookie!);

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });
});
