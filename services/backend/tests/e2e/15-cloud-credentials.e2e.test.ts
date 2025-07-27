import request from 'supertest';
import { FastifyInstance } from 'fastify';
import { getTestContext, updateTestContext } from './testContext';

describe('Cloud Credentials E2E Tests', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('should login regular user and get team information', async () => {
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
    
    // Store fresh session cookie
    const regularUserCookie = loginResponse.headers['set-cookie'][0];
    
    // Get user's teams to find default team ID
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', regularUserCookie);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body.success).toBe(true);
    expect(teamsResponse.body.data).toHaveLength(2); // After previous tests cleanup
    
    // Find the default team (name matches username)
    const defaultTeam = teamsResponse.body.data.find((team: any) => team.name === 'regular_user');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.owner_id).toBe(context.secondUserId);
    
    // Store team ID and cookie for cloud credentials tests
    updateTestContext({
      regularUserCredentialsCookie: loginResponse.headers['set-cookie'][0],
      regularUserTeamId: defaultTeam.id
    });
  });

  it('should login regular user as team admin and get team information', async () => {
    const context = getTestContext();
    
    // Login with the regular user (global_user) from test 2
    // Regular users are team_admin of their own default teams
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
    
    // Store fresh session cookie
    const teamAdminCookie = loginResponse.headers['set-cookie'][0];
    
    // Get user's teams to find default team ID
    const teamsResponse = await request(server.server)
      .get('/api/teams/me')
      .set('Cookie', teamAdminCookie);

    expect(teamsResponse.status).toBe(200);
    expect(teamsResponse.body.success).toBe(true);
    expect(teamsResponse.body.data.length).toBeGreaterThan(0);
    
    // Find the default team (name matches username)
    const defaultTeam = teamsResponse.body.data.find((team: any) => team.name === 'regular_user');
    expect(defaultTeam).toBeDefined();
    expect(defaultTeam.is_default).toBe(true);
    
    // Verify user has team admin role in their own team
    expect(defaultTeam.role).toBe('team_admin');
    
    // Store for later tests
    updateTestContext({
      teamAdminCredentialsCookie: teamAdminCookie,
      teamAdminTeamId: defaultTeam.id
    });
  });

  it('should login global admin for metadata-only testing', async () => {
    const context = getTestContext();
    
    // Login with the global admin user from test 2
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
    
    // Store fresh session cookie for global admin tests
    const globalAdminCookie = loginResponse.headers['set-cookie'][0];
    
    // Store for later tests
    updateTestContext({
      globalAdminCredentialsCookie: globalAdminCookie
    });
  });

  it('should list available cloud providers', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .get(`/api/teams/${context.teamAdminTeamId}/cloud-providers`)
      .set('Cookie', context.teamAdminCredentialsCookie!);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBeGreaterThan(0);
    
    // Verify GCP provider exists
    const gcpProvider = response.body.data.find((provider: any) => provider.id === 'gcp');
    expect(gcpProvider).toBeDefined();
    expect(gcpProvider.name).toBe('Google Cloud Platform');
    expect(gcpProvider.enabled).toBe(true);
    expect(gcpProvider.fields).toBeInstanceOf(Array);
    
    // Verify required fields exist
    const serviceAccountField = gcpProvider.fields.find((field: any) => field.key === 'service_account_key');
    const projectIdField = gcpProvider.fields.find((field: any) => field.key === 'project_id');
    
    expect(serviceAccountField).toBeDefined();
    expect(serviceAccountField.required).toBe(true);
    expect(serviceAccountField.secret).toBe(true);
    expect(serviceAccountField.type).toBe('textarea');
    
    expect(projectIdField).toBeDefined();
    expect(projectIdField.required).toBe(true);
    expect(projectIdField.secret).toBe(false);
    expect(projectIdField.type).toBe('text');
  });

  it('should create first cloud credential as team admin', async () => {
    const context = getTestContext();
    
    const credentialData = {
      providerId: 'gcp',
      name: 'Test GCP Credentials',
      comment: 'Test credentials for E2E testing',
      credentials: {
        service_account_key: '{\n  "type": "service_account",\n  "project_id": "test-project-123",\n  "private_key_id": "test-key-id-123456",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJT...TEST...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "test-service@test-project-123.iam.gserviceaccount.com",\n  "client_id": "123456789012345678901",\n  "auth_uri": "https://accounts.google.com/o/oauth2/auth",\n  "token_uri": "https://oauth2.googleapis.com/token",\n  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",\n  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test-service%40test-project-123.iam.gserviceaccount.com"\n}',
        project_id: 'test-project-123'
      }
    };

    const response = await request(server.server)
      .post(`/api/teams/${context.teamAdminTeamId}/cloud-credentials`)
      .set('Cookie', context.teamAdminCredentialsCookie!)
      .send(credentialData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.message).toBeDefined();
    
    const credential = response.body.data;
    expect(credential.id).toBeDefined();
    expect(credential.teamId).toBe(context.teamAdminTeamId);
    expect(credential.providerId).toBe('gcp');
    expect(credential.name).toBe(credentialData.name);
    expect(credential.comment).toBe(credentialData.comment);
    expect(credential.createdBy).toBe(context.secondUserId);
    
    // Verify provider information
    expect(credential.provider.id).toBe('gcp');
    expect(credential.provider.name).toBe('Google Cloud Platform');
    
    // Verify fields structure - team admin should see non-secret values but no secret values
    expect(credential.fields).toBeDefined();
    expect(credential.fields.project_id).toBeDefined();
    expect(credential.fields.project_id.hasValue).toBe(true);
    expect(credential.fields.project_id.secret).toBe(false);
    expect(credential.fields.project_id.value).toBe('PLACEHOLDER_VALUE'); // Non-secret field shows placeholder
    
    expect(credential.fields.service_account_key).toBeDefined();
    expect(credential.fields.service_account_key.hasValue).toBe(true);
    expect(credential.fields.service_account_key.secret).toBe(true);
    expect(credential.fields.service_account_key.value).toBeUndefined(); // Secret field never shows value
    
    // Store credential ID for later tests
    updateTestContext({
      firstCredentialId: credential.id
    });
  });

  it('should create credential for edit/delete testing', async () => {
    const context = getTestContext();
    
    const credentialData = {
      providerId: 'gcp',
      name: 'Edit Test GCP Credentials',
      comment: 'Credentials for edit/delete testing',
      credentials: {
        service_account_key: '{\n  "type": "service_account",\n  "project_id": "edit-test-project-456",\n  "private_key_id": "edit-key-id-456789",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJT...EDIT...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "edit-service@edit-test-project-456.iam.gserviceaccount.com",\n  "client_id": "456789012345678901234",\n  "auth_uri": "https://accounts.google.com/o/oauth2/auth",\n  "token_uri": "https://oauth2.googleapis.com/token",\n  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",\n  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/edit-service%40edit-test-project-456.iam.gserviceaccount.com"\n}',
        project_id: 'edit-test-project-456'
      }
    };

    const response = await request(server.server)
      .post(`/api/teams/${context.teamAdminTeamId}/cloud-credentials`)
      .set('Cookie', context.teamAdminCredentialsCookie!)
      .send(credentialData);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    
    // Store credential ID for edit/delete tests
    updateTestContext({
      editTestCredentialId: response.body.data.id
    });
  });

  it('should edit own credential as team admin', async () => {
    const context = getTestContext();
    
    // Debug: Check if editTestCredentialId exists
    expect(context.editTestCredentialId).toBeDefined();
    expect(context.editTestCredentialId).not.toBe('undefined');
    
    const updateData = {
      name: 'Updated Test GCP Credentials',
      comment: 'Updated comment for testing',
      credentials: {
        project_id: 'updated-test-project-789' // Update non-secret field
      }
    };

    const response = await request(server.server)
      .put(`/api/teams/${context.teamAdminTeamId}/cloud-credentials/${context.editTestCredentialId}`)
      .set('Cookie', context.teamAdminCredentialsCookie!)
      .send(updateData);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    expect(response.body.message).toBeDefined();
    
    const credential = response.body.data;
    expect(credential.name).toBe(updateData.name);
    expect(credential.comment).toBe(updateData.comment);
    
    // Verify updated field (team admin sees placeholder, not actual value)
    expect(credential.fields.project_id.value).toBe('PLACEHOLDER_VALUE');
    expect(credential.fields.project_id.hasValue).toBe(true);
    
    // Verify secret field remains unchanged (still has value but not shown)
    expect(credential.fields.service_account_key.hasValue).toBe(true);
    expect(credential.fields.service_account_key.value).toBeUndefined();
  });

  it('should delete own credential as team admin', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .delete(`/api/teams/${context.teamAdminTeamId}/cloud-credentials/${context.editTestCredentialId}`)
      .set('Cookie', context.teamAdminCredentialsCookie!);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBeDefined();
    
    // Verify credential is deleted by trying to get it
    const getResponse = await request(server.server)
      .get(`/api/teams/${context.teamAdminTeamId}/cloud-credentials/${context.editTestCredentialId}`)
      .set('Cookie', context.teamAdminCredentialsCookie!);

    expect(getResponse.status).toBe(404);
  });

  it('should create two example credentials for global admin testing', async () => {
    const context = getTestContext();
    
    // Create first credential in team admin's team
    const credential1Data = {
      providerId: 'gcp',
      name: 'Production GCP',
      comment: 'Production environment credentials',
      credentials: {
        service_account_key: '{\n  "type": "service_account",\n  "project_id": "prod-project-123",\n  "private_key_id": "prod-key-id-123456",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJT...PROD...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "prod-service@prod-project-123.iam.gserviceaccount.com",\n  "client_id": "123456789012345678901",\n  "auth_uri": "https://accounts.google.com/o/oauth2/auth",\n  "token_uri": "https://oauth2.googleapis.com/token",\n  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",\n  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/prod-service%40prod-project-123.iam.gserviceaccount.com"\n}',
        project_id: 'prod-project-123'
      }
    };

    const response1 = await request(server.server)
      .post(`/api/teams/${context.teamAdminTeamId}/cloud-credentials`)
      .set('Cookie', context.teamAdminCredentialsCookie!)
      .send(credential1Data);

    expect(response1.status).toBe(201);
    expect(response1.body.success).toBe(true);
    
    // Create second credential in team admin's team
    const credential2Data = {
      providerId: 'gcp',
      name: 'Staging GCP',
      comment: 'Staging environment credentials',
      credentials: {
        service_account_key: '{\n  "type": "service_account",\n  "project_id": "staging-project-456",\n  "private_key_id": "staging-key-id-456789",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJT...STAGING...\\n-----END PRIVATE KEY-----\\n",\n  "client_email": "staging-service@staging-project-456.iam.gserviceaccount.com",\n  "client_id": "456789012345678901234",\n  "auth_uri": "https://accounts.google.com/o/oauth2/auth",\n  "token_uri": "https://oauth2.googleapis.com/token",\n  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",\n  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/staging-service%40staging-project-456.iam.gserviceaccount.com"\n}',
        project_id: 'staging-project-456'
      }
    };

    const response2 = await request(server.server)
      .post(`/api/teams/${context.teamAdminTeamId}/cloud-credentials`)
      .set('Cookie', context.teamAdminCredentialsCookie!)
      .send(credential2Data);

    expect(response2.status).toBe(201);
    expect(response2.body.success).toBe(true);
    
    // Store credential IDs for global admin access tests
    updateTestContext({
      prodCredentialId: response1.body.data.id,
      stagingCredentialId: response2.body.data.id
    });
  });

  it('should allow global admin to view team credentials with metadata only', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .get(`/api/teams/${context.teamAdminTeamId}/cloud-credentials`)
      .set('Cookie', context.globalAdminCredentialsCookie!);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data).toHaveLength(3); // Test, Production and Staging credentials
    
    // Verify global admin gets metadata-only response for other team's credentials
    const credentials = response.body.data;
    
    for (const credential of credentials) {
      expect(credential.id).toBeDefined();
      expect(credential.name).toBeDefined();
      expect(credential.providerId).toBe('gcp');
      expect(credential.teamId).toBe(context.teamAdminTeamId);
      expect(credential.createdBy).toBe(context.secondUserId);
      
      // Global admin should see field metadata but NO values (even for non-secret fields)
      expect(credential.fields).toBeDefined();
      expect(credential.fields.project_id).toBeDefined();
      expect(credential.fields.project_id.hasValue).toBe(true);
      expect(credential.fields.project_id.secret).toBe(false);
      expect(credential.fields.project_id.value).toBeUndefined(); // Global admin sees no values
      
      expect(credential.fields.service_account_key).toBeDefined();
      expect(credential.fields.service_account_key.hasValue).toBe(true);
      expect(credential.fields.service_account_key.secret).toBe(true);
      expect(credential.fields.service_account_key.value).toBeUndefined(); // Global admin sees no values
    }
    
    // Verify we can find both credentials
    const prodCredential = credentials.find((c: any) => c.name === 'Production GCP');
    const stagingCredential = credentials.find((c: any) => c.name === 'Staging GCP');
    
    expect(prodCredential).toBeDefined();
    expect(stagingCredential).toBeDefined();
  });

  it('should prevent global admin from accessing non-existent team credentials', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .get('/api/teams/non-existent-team-id/cloud-credentials')
      .set('Cookie', context.globalAdminCredentialsCookie!);

    // Global admin should not be able to access non-existent team
    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  it('should allow global admin to view specific credential metadata only', async () => {
    const context = getTestContext();
    
    const response = await request(server.server)
      .get(`/api/teams/${context.teamAdminTeamId}/cloud-credentials/${context.prodCredentialId}`)
      .set('Cookie', context.globalAdminCredentialsCookie!);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toBeDefined();
    
    const credential = response.body.data;
    expect(credential.name).toBe('Production GCP');
    expect(credential.comment).toBe('Production environment credentials');
    
    // Verify global admin sees metadata but no actual values
    expect(credential.fields.project_id.hasValue).toBe(true);
    expect(credential.fields.project_id.secret).toBe(false);
    expect(credential.fields.project_id.value).toBeUndefined(); // No value for global admin
    
    expect(credential.fields.service_account_key.hasValue).toBe(true);
    expect(credential.fields.service_account_key.secret).toBe(true);
    expect(credential.fields.service_account_key.value).toBeUndefined(); // No value for global admin
  });

  it('should verify no secret values are ever returned in any response', async () => {
    const context = getTestContext();
    
    // Test as global admin viewing other team's credentials
    const globalAdminResponse = await request(server.server)
      .get(`/api/teams/${context.teamAdminTeamId}/cloud-credentials/${context.prodCredentialId}`)
      .set('Cookie', context.globalAdminCredentialsCookie!);

    expect(globalAdminResponse.status).toBe(200);
    const globalAdminCredential = globalAdminResponse.body.data;
    
    // Global admin should see no values at all for other team's credentials
    expect(globalAdminCredential.fields.service_account_key.value).toBeUndefined();
    expect(globalAdminCredential.fields.project_id.value).toBeUndefined();
    expect(globalAdminCredential.fields.service_account_key.hasValue).toBe(true);
    expect(globalAdminCredential.fields.project_id.hasValue).toBe(true);
    
    // Verify secret fields are properly marked
    expect(globalAdminCredential.fields.service_account_key.secret).toBe(true);
    expect(globalAdminCredential.fields.project_id.secret).toBe(false);
    
    // Test as team admin viewing own team's credentials
    const teamAdminResponse = await request(server.server)
      .get(`/api/teams/${context.teamAdminTeamId}/cloud-credentials/${context.prodCredentialId}`)
      .set('Cookie', context.teamAdminCredentialsCookie!);

    expect(teamAdminResponse.status).toBe(200);
    const teamAdminCredential = teamAdminResponse.body.data;
    
    // Team admin should see placeholder for non-secret fields but never secret values
    expect(teamAdminCredential.fields.service_account_key.value).toBeUndefined(); // Secret never shown
    expect(teamAdminCredential.fields.project_id.value).toBe('PLACEHOLDER_VALUE'); // Non-secret shows placeholder
    expect(teamAdminCredential.fields.service_account_key.hasValue).toBe(true);
    expect(teamAdminCredential.fields.project_id.hasValue).toBe(true);
  });

  it('should handle validation errors correctly', async () => {
    const context = getTestContext();
    
    // Test invalid provider ID
    const invalidProviderResponse = await request(server.server)
      .post(`/api/teams/${context.teamAdminTeamId}/cloud-credentials`)
      .set('Cookie', context.teamAdminCredentialsCookie!)
      .send({
        providerId: 'invalid-provider',
        name: 'Test Credential',
        credentials: {}
      });

    expect(invalidProviderResponse.status).toBe(400);
    expect(invalidProviderResponse.body.success).toBe(false);
    expect(invalidProviderResponse.body.error).toBeDefined();
    
    // Test missing required fields
    const missingFieldsResponse = await request(server.server)
      .post(`/api/teams/${context.teamAdminTeamId}/cloud-credentials`)
      .set('Cookie', context.teamAdminCredentialsCookie!)
      .send({
        providerId: 'gcp',
        name: 'Test Credential',
        credentials: {
          project_id: 'test-project-123'
          // Missing service_account_key
        }
      });

    expect(missingFieldsResponse.status).toBe(400);
    expect(missingFieldsResponse.body.success).toBe(false);
    expect(missingFieldsResponse.body.error).toBeDefined();
    
    // Test duplicate credential name
    const duplicateNameResponse = await request(server.server)
      .post(`/api/teams/${context.teamAdminTeamId}/cloud-credentials`)
      .set('Cookie', context.teamAdminCredentialsCookie!)
      .send({
        providerId: 'gcp',
        name: 'Production GCP', // Same name as existing credential
        credentials: {
          service_account_key: '{"type": "service_account", "project_id": "duplicate-test"}',
          project_id: 'duplicate-test-project'
        }
      });

    expect(duplicateNameResponse.status).toBe(400);
    expect(duplicateNameResponse.body.success).toBe(false);
    expect(duplicateNameResponse.body.error).toBeDefined();
  });

  it('should handle unauthorized access correctly', async () => {
    const context = getTestContext();
    
    // Test without authentication
    const noAuthResponse = await request(server.server)
      .get(`/api/teams/${context.regularUserTeamId}/cloud-credentials`);

    expect(noAuthResponse.status).toBe(401);
    expect(noAuthResponse.body.success).toBe(false);
    expect(noAuthResponse.body.error).toBeDefined();
    
    // Test accessing non-existent team
    const invalidTeamResponse = await request(server.server)
      .get('/api/teams/non-existent-team-id/cloud-credentials')
      .set('Cookie', context.regularUserCredentialsCookie!);

    expect(invalidTeamResponse.status).toBe(403);
    expect(invalidTeamResponse.body.success).toBe(false);
    expect(invalidTeamResponse.body.error).toBeDefined();
    
    // Test accessing non-existent credential
    const invalidCredentialResponse = await request(server.server)
      .get(`/api/teams/${context.regularUserTeamId}/cloud-credentials/non-existent-credential-id`)
      .set('Cookie', context.regularUserCredentialsCookie!);

    expect(invalidCredentialResponse.status).toBe(404);
    expect(invalidCredentialResponse.body.success).toBe(false);
    expect(invalidCredentialResponse.body.error).toBeDefined();
  });
});
