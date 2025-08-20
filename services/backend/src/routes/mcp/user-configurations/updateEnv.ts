import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { updateUserEnvSchema, UpdateUserEnvRouteRequest, formatUserConfigResponse } from './schemas';
import { mcpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { authHook } from '../../../hooks/authHook';

export default async function updateUserEnvRoute(fastify: FastifyInstance) {
  fastify.patch<UpdateUserEnvRouteRequest>(
    '/teams/:teamId/mcp/installations/:installationId/user-configs/:configId/env',
    {
      schema: updateUserEnvSchema,
      preHandler: [authHook]
    },
    async (request: FastifyRequest<UpdateUserEnvRouteRequest>, reply: FastifyReply) => {
      const { teamId, installationId, configId } = request.params;
      const userId = request.user!.id;
      const { env } = request.body;

      try {
        // Update the user configuration environment variables
        const updatedConfig = await mcpUserConfigurationService.updateUserEnv(
          configId,
          userId,
          teamId,
          env
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
          message: 'User configuration environment variables updated successfully'
        });

      } catch (error) {
        fastify.log.error({
          operation: 'update_user_configuration_env',
          error,
          teamId,
          installationId,
          configId,
          userId
        }, 'Error updating user configuration env');
        
        // Handle validation errors
        if (error instanceof Error && (
          error.message.includes('required') || 
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
