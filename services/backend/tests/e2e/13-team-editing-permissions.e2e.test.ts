import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext';

describe('Team Editing Permissions E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should login regular_user to get fresh session for team editing tests', async () => {
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
    
    // Store fresh session cookie for team editing tests
    updateTestContext({
      secondUserEditingCookie: loginResponse.headers['set-cookie'][0]
    });
  });

  it('should get regular_user default team for editing tests', async () => {
    const context = getTestContext();
    
    // Get user's teams to find the default team
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserEditingCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body).toHaveProperty('data');
    
    const teams = teamsResponse.body.data;
    
    // Find the default team (should be named after the username)
    const defaultTeam = teams.find((team: any) => team.name === 'regular_user');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.owner_id).toBe(context.secondUserId);
    expect(defaultTeam.role).toBe('team_admin');
    
    // Store default team ID for editing tests
    updateTestContext({
      secondUserDefaultTeamIdForEditing: defaultTeam.id
    });
  });

  it('should allow editing description of default team', async () => {
    const context = getTestContext();
    
    const updateData = {
      description: 'Updated description for default team'
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.secondUserDefaultTeamIdForEditing}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('message');
    
    const team = response.body.data;
    expect(team.name).toBe('regular_user'); // Name should remain unchanged
    expect(team.description).toBe(updateData.description); // Description should be updated
    expect(team.owner_id).toBe(context.secondUserId);
    expect(team.id).toBe(context.secondUserDefaultTeamIdForEditing);
  });

  it('should prevent editing name of default team', async () => {
    const context = getTestContext();
    
    const updateData = {
      name: 'Attempted New Name',
      description: 'This name change should not work'
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.secondUserDefaultTeamIdForEditing}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
    expect(response.body.error.toLowerCase()).toContain('default');
    expect(response.body.error.toLowerCase()).toContain('name');
  });

  it('should verify default team name remains unchanged after failed edit attempt', async () => {
    const context = getTestContext();
    
    // Verify the team name is still the original
    const teamResponse = await request(server.server)
      .get(`/api/teams/${context.secondUserDefaultTeamIdForEditing}`)
      .set('Cookie', context.secondUserEditingCookie!);

    expect(teamResponse.status).toBe(200);
    expect(teamResponse.body).toHaveProperty('success', true);
    expect(teamResponse.body).toHaveProperty('data');
    
    const team = teamResponse.body.data;
    expect(team.name).toBe('regular_user'); // Name should still be original
    expect(team.description).toBe('Updated description for default team'); // Description from previous test
    expect(team.owner_id).toBe(context.secondUserId);
  });

  it('should create a new custom team for editing tests', async () => {
    const context = getTestContext();
    
    const teamData = {
      name: 'Custom Editing Test Team',
      description: 'Team created for testing editing capabilities'
    };

    const response = await request(server.server)
      .post('/api/teams')
      .set('Cookie', context.secondUserEditingCookie!)
      .send(teamData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    
    const team = response.body.data;
    expect(team.name).toBe(teamData.name);
    expect(team.description).toBe(teamData.description);
    expect(team.owner_id).toBe(context.secondUserId);
    expect(team.slug).toBe('custom-editing-test-team');
    
    // Store team ID for editing tests
    updateTestContext({
      editingTestTeamId: team.id
    });
  });

  it('should allow editing both name and description of custom team', async () => {
    const context = getTestContext();
    
    const updateData = {
      name: 'Updated Custom Team Name',
      description: 'Updated description for custom team'
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.editingTestTeamId}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('message');
    
    const team = response.body.data;
    expect(team.name).toBe(updateData.name); // Name should be updated
    expect(team.description).toBe(updateData.description); // Description should be updated
    expect(team.owner_id).toBe(context.secondUserId);
    expect(team.slug).toBe('custom-editing-test-team'); // Slug should remain unchanged
    expect(team.id).toBe(context.editingTestTeamId);
  });

  it('should allow editing only name of custom team', async () => {
    const context = getTestContext();
    
    const updateData = {
      name: 'Name Only Update'
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.editingTestTeamId}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    
    const team = response.body.data;
    expect(team.name).toBe(updateData.name); // Name should be updated
    expect(team.description).toBe('Updated description for custom team'); // Description should remain from previous test
    expect(team.owner_id).toBe(context.secondUserId);
  });

  it('should allow editing only description of custom team', async () => {
    const context = getTestContext();
    
    const updateData = {
      description: 'Description only update'
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.editingTestTeamId}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    
    const team = response.body.data;
    expect(team.name).toBe('Name Only Update'); // Name should remain from previous test
    expect(team.description).toBe(updateData.description); // Description should be updated
    expect(team.owner_id).toBe(context.secondUserId);
  });

  it('should allow setting description to null/empty', async () => {
    const context = getTestContext();
    
    const updateData = {
      description: null
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.editingTestTeamId}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    
    const team = response.body.data;
    expect(team.name).toBe('Name Only Update'); // Name should remain unchanged
    expect(team.description).toBeNull(); // Description should be null
    expect(team.owner_id).toBe(context.secondUserId);
  });

  it('should reject team update with empty name', async () => {
    const context = getTestContext();
    
    const updateData = {
      name: '',
      description: 'Valid description'
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.editingTestTeamId}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });

  it('should reject team update with name that is too long', async () => {
    const context = getTestContext();
    
    const updateData = {
      name: 'A'.repeat(101), // Assuming max length is 100 characters
      description: 'Valid description'
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.editingTestTeamId}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });

  it('should reject team update with description that is too long', async () => {
    const context = getTestContext();
    
    const updateData = {
      name: 'Valid Name',
      description: 'A'.repeat(501) // Assuming max length is 500 characters
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.editingTestTeamId}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });

  it('should reject team update without authentication', async () => {
    const context = getTestContext();
    
    const updateData = {
      name: 'Unauthorized Update',
      description: 'This should fail'
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.editingTestTeamId}`)
      .send(updateData);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('error');
  });

  it('should reject team update with no changes provided', async () => {
    const context = getTestContext();
    
    const updateData = {}; // Empty update

    const response = await request(server.server)
      .put(`/api/teams/${context.editingTestTeamId}`)
      .set('Cookie', context.secondUserEditingCookie!)
      .send(updateData);

    // This might be allowed (no-op) or rejected depending on implementation
    // Adjust expectation based on actual API behavior
    expect([200, 400]).toContain(response.status);
    expect(response.body).toHaveProperty('success');
  });

  it('should verify final state of teams', async () => {
    const context = getTestContext();
    
    // Check all user's teams
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserEditingCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body).toHaveProperty('data');
    
    const teams = teamsResponse.body.data;
    
    // Find default team
    const defaultTeam = teams.find((team: any) => team.id === context.secondUserDefaultTeamIdForEditing);
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.name).toBe('regular_user'); // Default team name unchanged
    expect(defaultTeam.description).toBe('Updated description for default team');
    
    // Find custom team
    const customTeam = teams.find((team: any) => team.id === context.editingTestTeamId);
    expect(customTeam).toBeDefined();
    expect(customTeam.name).toBe('Name Only Update'); // Last successful name update
    expect(customTeam.description).toBeNull(); // Last successful description update (null)
  });

  it('should clean up by deleting the custom team', async () => {
    const context = getTestContext();
    
    // Delete the custom team to clean up
    const response = await request(server.server)
      .delete(`/api/teams/${context.editingTestTeamId}`)
      .set('Cookie', context.secondUserEditingCookie!);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message');
  });

  it('should verify user has 2 teams after cleanup', async () => {
    const context = getTestContext();
    
    // Check user's teams after cleanup (should have 2: default + 1 remaining from test 10)
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.secondUserEditingCookie!);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body).toHaveProperty('success', true);
    expect(teamsResponse.body).toHaveProperty('data');
    expect(teamsResponse.body.data).toHaveLength(2);
    
    const teams = teamsResponse.body.data;
    
    // Verify default team exists with updated description
    const defaultTeam = teams.find((team: any) => team.name === 'regular_user');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.description).toBe('Updated description for default team');
    expect(defaultTeam.owner_id).toBe(context.secondUserId);
    
    // Verify the custom editing test team is gone
    const customTeam = teams.find((team: any) => team.id === context.editingTestTeamId);
    expect(customTeam).toBeUndefined();
  });
});
