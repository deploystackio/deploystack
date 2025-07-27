import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext';

describe('Cloud Credentials Cross-User Permissions E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should register test_credentials_user_1 and assign global_user role', async () => {
    // Register the first test user for credentials testing
    const testUser1Data = {
      username: 'test_credentials_user_1',
      email: 'test_credentials_user_1@example.com',
      password: 'SecurePassword123!',
      first_name: 'Test',
      last_name: 'CredentialsUser1'
    };

    const registerResponse = await request(server.server)
      .post('/api/auth/email/register')
      .send(testUser1Data);

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body).toHaveProperty('success', true);
    expect(registerResponse.body).toHaveProperty('user');
    
    const user = registerResponse.body.user;
    expect(user.username).toBe(testUser1Data.username);
    expect(user.email).toBe(testUser1Data.email);
    expect(user.first_name).toBe(testUser1Data.first_name);
    expect(user.last_name).toBe(testUser1Data.last_name);
    
    // Verify the user gets global_user role (not admin since this isn't the first user)
    expect(user.role_id).toBe('global_user');
    
    // Verify user has a session cookie
    expect(registerResponse.headers['set-cookie']).toBeDefined();
    
    // Store user ID and cookie for later tests
    updateTestContext({
      testCredentialsUser1Id: user.id,
      testCredentialsUser1Cookie: registerResponse.headers['set-cookie'][0]
    });
  });

  it('should register test_credentials_user_2 and assign global_user role', async () => {
    // Register the second test user for credentials testing
    const testUser2Data = {
      username: 'test_credentials_user_2',
      email: 'test_credentials_user_2@example.com',
      password: 'SecurePassword456!',
      first_name: 'Test',
      last_name: 'CredentialsUser2'
    };

    const registerResponse = await request(server.server)
      .post('/api/auth/email/register')
      .send(testUser2Data);

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body).toHaveProperty('success', true);
    expect(registerResponse.body).toHaveProperty('user');
    
    const user = registerResponse.body.user;
    expect(user.username).toBe(testUser2Data.username);
    expect(user.email).toBe(testUser2Data.email);
    expect(user.first_name).toBe(testUser2Data.first_name);
    expect(user.last_name).toBe(testUser2Data.last_name);
    
    // Verify the user gets global_user role
    expect(user.role_id).toBe('global_user');
    
    // Verify user has a session cookie
    expect(registerResponse.headers['set-cookie']).toBeDefined();
    
    // Store user ID and cookie for later tests
    updateTestContext({
      testCredentialsUser2Id: user.id,
      testCredentialsUser2Cookie: registerResponse.headers['set-cookie'][0]
    });
  });

  it('should verify both test users have their own default teams', async () => {
    const context = getTestContext();
    
    // Check test_credentials_user_1's teams
    const user1TeamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.testCredentialsUser1Cookie!);

    expect(user1TeamsResponse.status).toBe(200);
    expect(user1TeamsResponse.body).toHaveProperty('success', true);
    expect(user1TeamsResponse.body).toHaveProperty('data');
    expect(user1TeamsResponse.body.data).toHaveLength(1);
    
    const user1Team = user1TeamsResponse.body.data[0];
    expect(user1Team.name).toBe('test_credentials_user_1'); // Default team name is username
    expect(user1Team.owner_id).toBe(context.testCredentialsUser1Id);
    expect(user1Team.role).toBe('team_admin'); // User is admin of their own team

    // Check test_credentials_user_2's teams
    const user2TeamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', context.testCredentialsUser2Cookie!);

    expect(user2TeamsResponse.status).toBe(200);
    expect(user2TeamsResponse.body).toHaveProperty('success', true);
    expect(user2TeamsResponse.body).toHaveProperty('data');
    expect(user2TeamsResponse.body.data).toHaveLength(1);
    
    const user2Team = user2TeamsResponse.body.data[0];
    expect(user2Team.name).toBe('test_credentials_user_2'); // Default team name is username
    expect(user2Team.owner_id).toBe(context.testCredentialsUser2Id);
    expect(user2Team.role).toBe('team_admin'); // User is admin of their own team

    // Store team IDs for later tests
    updateTestContext({
      testCredentialsUser1TeamId: user1Team.id,
      testCredentialsUser2TeamId: user2Team.id
    });
  });

  it('should allow test_credentials_user_1 to create cloud credentials in their team', async () => {
    const context = getTestContext();
    
    const credentialData = {
      providerId: 'gcp',
      name: 'User1 Test Credentials',
      comment: 'Test credentials for cross-user permission testing',
      credentials: {
        service_account_key: '{\n  "type": "service_account",\n  "project_id": "user1-test-project-123",\n  "private_key_id": "user1-key-id-123456",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJT...USER1...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "user1-service@user1-test-project-123.iam.gserviceaccount.com",\n  "client_id": "123456789012345678901",\n  "auth_uri": "https://accounts.google.com/o/oauth2/auth",\n  "token_uri": "https://oauth2.googleapis.com/token",\n  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",\n  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/user1-service%40user1-test-project-123.iam.gserviceaccount.com"\n}',
        project_id: 'user1-test-project-123'
      }
    };

    const response = await request(server.server)
      .post(`/api/teams/${context.testCredentialsUser1TeamId}/cloud-credentials`)
      .set('Cookie', context.testCredentialsUser1Cookie!)
      .send(credentialData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.message).toBeDefined();
    
    const credential = response.body.data;
    expect(credential.id).toBeDefined();
    expect(credential.teamId).toBe(context.testCredentialsUser1TeamId);
    expect(credential.providerId).toBe('gcp');
    expect(credential.name).toBe(credentialData.name);
    expect(credential.comment).toBe(credentialData.comment);
    // Handle both possible response formats for createdBy
    const createdById = typeof credential.createdBy === 'object' ? credential.createdBy.id : credential.createdBy;
    expect(createdById).toBe(context.testCredentialsUser1Id);
    
    // Verify provider information
    expect(credential.provider.id).toBe('gcp');
    expect(credential.provider.name).toBe('Google Cloud Platform');
    
    // Verify fields structure - team admin should see placeholder for non-secret fields
    expect(credential.fields).toBeDefined();
    expect(credential.fields.project_id).toBeDefined();
    expect(credential.fields.project_id.hasValue).toBe(true);
    expect(credential.fields.project_id.secret).toBe(false);
    expect(credential.fields.project_id.value).toBe('PLACEHOLDER_VALUE');
    
    expect(credential.fields.service_account_key).toBeDefined();
    expect(credential.fields.service_account_key.hasValue).toBe(true);
    expect(credential.fields.service_account_key.secret).toBe(true);
    expect(credential.fields.service_account_key.value).toBeUndefined(); // Secret field never shows value
    
    // Store credential ID for cross-user access tests
    updateTestContext({
      testCredentialsUser1CredentialId: credential.id
    });
  });

  it('should prevent test_credentials_user_2 from listing user_1 team credentials', async () => {
    const context = getTestContext();
    
    // User 2 attempts to list User 1's team credentials
    const response = await request(server.server)
      .get(`/api/teams/${context.testCredentialsUser1TeamId}/cloud-credentials`)
      .set('Cookie', context.testCredentialsUser2Cookie!);

    // Should be forbidden - User 2 is not a member of User 1's team
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  it('should prevent test_credentials_user_2 from viewing specific user_1 credential', async () => {
    const context = getTestContext();
    
    // User 2 attempts to view User 1's specific credential
    const response = await request(server.server)
      .get(`/api/teams/${context.testCredentialsUser1TeamId}/cloud-credentials/${context.testCredentialsUser1CredentialId}`)
      .set('Cookie', context.testCredentialsUser2Cookie!);

    // Should be forbidden - User 2 is not a member of User 1's team
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  it('should prevent test_credentials_user_2 from updating user_1 credentials', async () => {
    const context = getTestContext();
    
    const updateData = {
      name: 'Malicious Update Attempt',
      comment: 'This should not work',
      credentials: {
        project_id: 'malicious-project-999'
      }
    };

    // User 2 attempts to update User 1's credential
    const response = await request(server.server)
      .put(`/api/teams/${context.testCredentialsUser1TeamId}/cloud-credentials/${context.testCredentialsUser1CredentialId}`)
      .set('Cookie', context.testCredentialsUser2Cookie!)
      .send(updateData);

    // Should be forbidden - User 2 is not a member of User 1's team
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  it('should prevent test_credentials_user_2 from deleting user_1 credentials', async () => {
    const context = getTestContext();
    
    // User 2 attempts to delete User 1's credential
    const response = await request(server.server)
      .delete(`/api/teams/${context.testCredentialsUser1TeamId}/cloud-credentials/${context.testCredentialsUser1CredentialId}`)
      .set('Cookie', context.testCredentialsUser2Cookie!);

    // Should be forbidden - User 2 is not a member of User 1's team
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  it('should verify user_1 credentials remain intact after unauthorized access attempts', async () => {
    const context = getTestContext();
    
    // User 1 verifies their credential still exists and is unchanged
    const response = await request(server.server)
      .get(`/api/teams/${context.testCredentialsUser1TeamId}/cloud-credentials/${context.testCredentialsUser1CredentialId}`)
      .set('Cookie', context.testCredentialsUser1Cookie!);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    
    const credential = response.body.data;
    expect(credential.name).toBe('User1 Test Credentials'); // Original name unchanged
    expect(credential.comment).toBe('Test credentials for cross-user permission testing'); // Original comment unchanged
    expect(credential.createdBy.id).toBe(context.testCredentialsUser1Id);
    expect(credential.teamId).toBe(context.testCredentialsUser1TeamId);
    
    // Verify fields are still intact
    expect(credential.fields.project_id.hasValue).toBe(true);
    expect(credential.fields.service_account_key.hasValue).toBe(true);
  });

  it('should allow test_credentials_user_2 to manage their own credentials', async () => {
    const context = getTestContext();
    
    // User 2 creates their own credentials in their own team
    const credentialData = {
      providerId: 'gcp',
      name: 'User2 Test Credentials',
      comment: 'Test credentials for user 2 own team',
      credentials: {
        service_account_key: '{\n  "type": "service_account",\n  "project_id": "user2-test-project-456",\n  "private_key_id": "user2-key-id-789012",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJT...USER2...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "user2-service@user2-test-project-456.iam.gserviceaccount.com",\n  "client_id": "789012345678901234567",\n  "auth_uri": "https://accounts.google.com/o/oauth2/auth",\n  "token_uri": "https://oauth2.googleapis.com/token",\n  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",\n  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/user2-service%40user2-test-project-456.iam.gserviceaccount.com"\n}',
        project_id: 'user2-test-project-456'
      }
    };

    const createResponse = await request(server.server)
      .post(`/api/teams/${context.testCredentialsUser2TeamId}/cloud-credentials`)
      .set('Cookie', context.testCredentialsUser2Cookie!)
      .send(credentialData);

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.data).toBeDefined();
    
    const credential = createResponse.body.data;
    expect(credential.teamId).toBe(context.testCredentialsUser2TeamId);
    // Handle both possible response formats for createdBy
    const createdById = typeof credential.createdBy === 'object' ? credential.createdBy.id : credential.createdBy;
    expect(createdById).toBe(context.testCredentialsUser2Id);
    expect(credential.name).toBe(credentialData.name);
    
    const user2CredentialId = credential.id;
    
    // User 2 can list their own team's credentials
    const listResponse = await request(server.server)
      .get(`/api/teams/${context.testCredentialsUser2TeamId}/cloud-credentials`)
      .set('Cookie', context.testCredentialsUser2Cookie!);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(listResponse.body.data).toHaveLength(1);
    expect(listResponse.body.data[0].id).toBe(user2CredentialId);
    
    // User 2 can view their own credential
    const viewResponse = await request(server.server)
      .get(`/api/teams/${context.testCredentialsUser2TeamId}/cloud-credentials/${user2CredentialId}`)
      .set('Cookie', context.testCredentialsUser2Cookie!);

    expect(viewResponse.status).toBe(200);
    expect(viewResponse.body.success).toBe(true);
    expect(viewResponse.body.data.id).toBe(user2CredentialId);
    
    // User 2 can update their own credential
    const updateData = {
      name: 'User2 Updated Credentials',
      comment: 'Updated comment for user 2'
    };

    const updateResponse = await request(server.server)
      .put(`/api/teams/${context.testCredentialsUser2TeamId}/cloud-credentials/${user2CredentialId}`)
      .set('Cookie', context.testCredentialsUser2Cookie!)
      .send(updateData);

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.data.name).toBe(updateData.name);
    expect(updateResponse.body.data.comment).toBe(updateData.comment);
    
    // User 2 can delete their own credential
    const deleteResponse = await request(server.server)
      .delete(`/api/teams/${context.testCredentialsUser2TeamId}/cloud-credentials/${user2CredentialId}`)
      .set('Cookie', context.testCredentialsUser2Cookie!);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
    expect(deleteResponse.body.message).toBeDefined();
  });

  it('should verify complete isolation between user teams', async () => {
    const context = getTestContext();
    
    // User 1 should not be able to access User 2's team
    const user1AccessUser2TeamResponse = await request(server.server)
      .get(`/api/teams/${context.testCredentialsUser2TeamId}/cloud-credentials`)
      .set('Cookie', context.testCredentialsUser1Cookie!);

    expect(user1AccessUser2TeamResponse.status).toBe(403);
    expect(user1AccessUser2TeamResponse.body.success).toBe(false);
    
    // User 2 should not be able to access User 1's team
    const user2AccessUser1TeamResponse = await request(server.server)
      .get(`/api/teams/${context.testCredentialsUser1TeamId}/cloud-credentials`)
      .set('Cookie', context.testCredentialsUser2Cookie!);

    expect(user2AccessUser1TeamResponse.status).toBe(403);
    expect(user2AccessUser1TeamResponse.body.success).toBe(false);
    
    // Verify User 1's credential still exists and is accessible only to User 1
    const user1CredentialResponse = await request(server.server)
      .get(`/api/teams/${context.testCredentialsUser1TeamId}/cloud-credentials`)
      .set('Cookie', context.testCredentialsUser1Cookie!);

    expect(user1CredentialResponse.status).toBe(200);
    expect(user1CredentialResponse.body.success).toBe(true);
    expect(user1CredentialResponse.body.data).toHaveLength(1);
    expect(user1CredentialResponse.body.data[0].name).toBe('User1 Test Credentials');
    
    // Verify User 2's team is empty (they deleted their credential)
    const user2CredentialResponse = await request(server.server)
      .get(`/api/teams/${context.testCredentialsUser2TeamId}/cloud-credentials`)
      .set('Cookie', context.testCredentialsUser2Cookie!);

    expect(user2CredentialResponse.status).toBe(200);
    expect(user2CredentialResponse.body.success).toBe(true);
    expect(user2CredentialResponse.body.data).toHaveLength(0);
  });
});
