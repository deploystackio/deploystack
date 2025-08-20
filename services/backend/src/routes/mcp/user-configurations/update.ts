import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { updateUserConfigurationSchema, UpdateUserConfigurationRequest, formatUserConfigResponse } from './schemas';
import { mcpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { authHook } from '../../../hooks/authHook';

export default async function updateUserConfigurationRoute(fastify: FastifyInstance) {
  fastify.put<UpdateUserConfigurationRequest>(
    '/teams/:teamId/mcp/installations/:installationId/user-configs/:configId',
    {
      schema: updateUserConfigurationSchema,
      preHandler: [authHook]
    },
    async (request: FastifyRequest<UpdateUserConfigurationRequest>, reply: FastifyReply) => {
      const { teamId, installationId, configId } = request.params;
      const userId = request.user!.id;
      const updateData = request.body;

      try {
        // Update the user configuration
        const updatedConfig = await mcpUserConfigurationService.updateUserConfiguration(
          configId,
          userId,
          teamId,
          updateData
        );

        if (!updatedConfig) {
          return reply.status(404).send({
            error: 'User configuration not found'
          });
        }

        // Format and return the response
        const response = formatUserConfigResponse(updatedConfig);
        return reply.send({
          success: true,
          data: response,
          message: 'User configuration updated successfully'
        });

      } catch (error) {
        fastify.log.error({
          operation: 'update_user_configuration',
          error,
          teamId,
          installationId,
          configId,
          userId
        }, 'Error updating user configuration');
        
        // Handle validation errors
        if (error instanceof Error && error.message.includes('already exists')) {
          return reply.status(409).send({
            error: error.message
          });
        }
        
        if (error instanceof Error && (
          error.message.includes('required') || 
          error.message.includes('arguments') ||
          error.message.includes('environment variable')
        )) {
          return reply.status(400).send({
            error: error.message
          });
        }

        return reply.status(500).send({
          error: 'Internal server error'
        });
      }
    }
  );
}
