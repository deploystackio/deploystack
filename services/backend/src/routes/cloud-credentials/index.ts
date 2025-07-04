/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance } from 'fastify';
import { getEnabledCloudProviders } from '../../config/cloud-providers';
import { CloudCredentialsService } from '../../services/cloudCredentialsService';
import { RoleService } from '../../services/roleService';
import { TeamService } from '../../services/teamService';
import { 
  listProvidersSchema,
  listCredentialsSchema,
  createCredentialSchema,
  getCredentialSchema,
  updateCredentialSchema,
  deleteCredentialSchema,
  CreateCloudCredentialSchema,
  UpdateCloudCredentialSchema,
  type CreateCloudCredentialInput,
  type UpdateCloudCredentialInput
} from './schemas';

/**
 * Check team-contextual permissions for cloud credentials
 */
async function checkCloudCredentialsPermission(
  teamId: string, 
  userId: string, 
  operation: 'view' | 'create' | 'edit' | 'delete'
): Promise<{ allowed: boolean; userType: 'global_admin' | 'team_admin' | 'team_user' | 'none' }> {
  const roleService = new RoleService();
  const userRole = await roleService.getUserRole(userId);
  
  // Check team membership first
  const teamMembership = await TeamService.getTeamMembership(teamId, userId);
  
  // If user is a team member, check team-based permissions
  if (teamMembership) {
    // Team admin has full CRUD access
    if (teamMembership.role === 'team_admin') {
      return { allowed: true, userType: 'team_admin' };
    }
    
    // Team user has view-only access
    if (teamMembership.role === 'team_user') {
      return { 
        allowed: operation === 'view', 
        userType: 'team_user' 
      };
    }
  }
  
  // If not a team member, check if user is global admin
  if (userRole?.id === 'global_admin') {
    // Global admin needs team to exist for view access
    const teamExists = await TeamService.getTeamById(teamId);
    if (!teamExists) {
      return { allowed: false, userType: 'none' };
    }
    // Global admin has view-only access to any existing team
    return { 
      allowed: operation === 'view', 
      userType: 'global_admin' 
    };
  }
  
  return { allowed: false, userType: 'none' };
}

export default async function cloudCredentialsRoutes(fastify: FastifyInstance) {
  const cloudCredentialsService = new CloudCredentialsService();

  // List available cloud providers
  fastify.get('/teams/:teamId/cloud-providers', {
    schema: listProvidersSchema
  }, async (request, reply) => {
    try {
      const { teamId } = request.params as { teamId: string };
      const userId = request.user?.id;
      
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Check permissions
      const { allowed } = await checkCloudCredentialsPermission(teamId, userId, 'view');
      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      const providers = getEnabledCloudProviders();
      
      return reply.status(200).send({
        success: true,
        data: providers
      });
    } catch (error) {
      request.log.error({
        error,
        operation: 'list_cloud_providers',
        teamId: (request.params as any).teamId
      }, 'Failed to list cloud providers');
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve cloud providers'
      });
    }
  });

  // List team's cloud credentials
  fastify.get('/teams/:teamId/cloud-credentials', {
    schema: listCredentialsSchema
  }, async (request, reply) => {
    try {
      const { teamId } = request.params as { teamId: string };
      const userId = request.user?.id;
      
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Check permissions
      const { allowed, userType } = await checkCloudCredentialsPermission(teamId, userId, 'view');
      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      let credentials;
      if (userType === 'team_admin') {
        // Team admin - show full details including field metadata and non-secret values
        credentials = await cloudCredentialsService.getTeamCredentials(teamId);
      } else if (userType === 'global_admin') {
        // Global admin - show field metadata but no values (secret or non-secret)
        credentials = await cloudCredentialsService.getTeamCredentialsGlobalAdmin(teamId);
      } else {
        // Team user - show basic details only
        credentials = await cloudCredentialsService.getTeamCredentialsBasic(teamId);
      }
      
      return reply.status(200).send({
        success: true,
        data: credentials
      });
    } catch (error) {
      request.log.error({
        error,
        operation: 'list_team_credentials',
        teamId: (request.params as any).teamId
      }, 'Failed to list team credentials');
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve team credentials'
      });
    }
  });

  // Create new cloud credentials
  fastify.post('/teams/:teamId/cloud-credentials', {
    schema: createCredentialSchema
  }, async (request, reply) => {
    try {
      const { teamId } = request.params as { teamId: string };
      const userId = request.user?.id;
      
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Check permissions
      const { allowed } = await checkCloudCredentialsPermission(teamId, userId, 'create');
      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      // Validate request body
      const validationResult = CreateCloudCredentialSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => err.message)
        });
      }

      const input: CreateCloudCredentialInput = validationResult.data;
      
      const credential = await cloudCredentialsService.createCredentials(teamId, userId, input);
      
      request.log.info({
        operation: 'create_cloud_credential',
        teamId,
        credentialId: credential.id,
        providerId: credential.providerId,
        userId
      }, 'Cloud credential created successfully');
      
      return reply.status(201).send({
        success: true,
        data: credential,
        message: 'Cloud credentials created successfully'
      });
    } catch (error) {
      request.log.error({
        error,
        operation: 'create_cloud_credential',
        teamId: (request.params as any).teamId,
        userId: request.user?.id
      }, 'Failed to create cloud credential');
      
      if (error instanceof Error) {
        if (error.message.includes('Validation failed') || 
            error.message.includes('Invalid provider') ||
            error.message.includes('already exists')) {
          return reply.status(error.message.includes('already exists') ? 409 : 400).send({
            success: false,
            error: error.message
          });
        }
      }
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to create cloud credentials'
      });
    }
  });

  // Get specific cloud credential
  fastify.get('/teams/:teamId/cloud-credentials/:credentialId', {
    schema: getCredentialSchema
  }, async (request, reply) => {
    try {
      const { teamId, credentialId } = request.params as { teamId: string; credentialId: string };
      const userId = request.user?.id;
      
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Check permissions
      const { allowed, userType } = await checkCloudCredentialsPermission(teamId, userId, 'view');
      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      let credential;
      if (userType === 'team_admin') {
        // Team admin - show full details including field metadata and non-secret values
        credential = await cloudCredentialsService.getCredentialById(credentialId, teamId);
      } else if (userType === 'global_admin') {
        // Global admin - show field metadata but no values (secret or non-secret)
        credential = await cloudCredentialsService.getCredentialByIdGlobalAdmin(credentialId, teamId);
      } else {
        // Team user - show basic details only
        credential = await cloudCredentialsService.getCredentialByIdBasic(credentialId, teamId);
      }
      
      if (!credential) {
        return reply.status(404).send({
          success: false,
          error: 'Cloud credential not found'
        });
      }
      
      return reply.status(200).send({
        success: true,
        data: credential
      });
    } catch (error) {
      request.log.error({
        error,
        operation: 'get_cloud_credential',
        teamId: (request.params as any).teamId,
        credentialId: (request.params as any).credentialId
      }, 'Failed to get cloud credential');
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve cloud credential'
      });
    }
  });

  // Update cloud credentials
  fastify.put('/teams/:teamId/cloud-credentials/:credentialId', {
    schema: updateCredentialSchema
  }, async (request, reply) => {
    try {
      const { teamId, credentialId } = request.params as { teamId: string; credentialId: string };
      const userId = request.user?.id;
      
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Check permissions
      const { allowed } = await checkCloudCredentialsPermission(teamId, userId, 'edit');
      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions'
        });
      }
      
      // Validate request body
      const validationResult = UpdateCloudCredentialSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => err.message)
        });
      }

      const input: UpdateCloudCredentialInput = validationResult.data;
      
      const credential = await cloudCredentialsService.updateCredentials(credentialId, teamId, input);
      
      if (!credential) {
        return reply.status(404).send({
          success: false,
          error: 'Cloud credential not found'
        });
      }
      
      request.log.info({
        operation: 'update_cloud_credential',
        teamId,
        credentialId,
        userId: request.user?.id
      }, 'Cloud credential updated successfully');
      
      return reply.status(200).send({
        success: true,
        data: credential,
        message: 'Cloud credentials updated successfully'
      });
    } catch (error) {
      request.log.error({
        error,
        operation: 'update_cloud_credential',
        teamId: (request.params as any).teamId,
        credentialId: (request.params as any).credentialId,
        userId: request.user?.id
      }, 'Failed to update cloud credential');
      
      if (error instanceof Error) {
        if (error.message.includes('Validation failed') || 
            error.message.includes('already exists')) {
          return reply.status(error.message.includes('already exists') ? 409 : 400).send({
            success: false,
            error: error.message
          });
        }
      }
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to update cloud credentials'
      });
    }
  });

  // Delete cloud credentials
  fastify.delete('/teams/:teamId/cloud-credentials/:credentialId', {
    schema: deleteCredentialSchema
  }, async (request, reply) => {
    try {
      const { teamId, credentialId } = request.params as { teamId: string; credentialId: string };
      const userId = request.user?.id;
      
      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Check permissions
      const { allowed } = await checkCloudCredentialsPermission(teamId, userId, 'delete');
      if (!allowed) {
        return reply.status(403).send({
          success: false,
          error: 'Insufficient permissions'
        });
      }
      
      const deleted = await cloudCredentialsService.deleteCredentials(credentialId, teamId);
      
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: 'Cloud credential not found'
        });
      }
      
      request.log.info({
        operation: 'delete_cloud_credential',
        teamId,
        credentialId,
        userId: request.user?.id
      }, 'Cloud credential deleted successfully');
      
      return reply.status(200).send({
        success: true,
        message: 'Cloud credentials deleted successfully'
      });
    } catch (error) {
      request.log.error({
        error,
        operation: 'delete_cloud_credential',
        teamId: (request.params as any).teamId,
        credentialId: (request.params as any).credentialId,
        userId: request.user?.id
      }, 'Failed to delete cloud credential');
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete cloud credentials'
      });
    }
  });
}
