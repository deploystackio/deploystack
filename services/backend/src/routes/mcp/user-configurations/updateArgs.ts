import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { updateUserArgsSchema, UpdateUserArgsRouteRequest, formatUserConfigResponse } from './schemas';
import { mcpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { authHook } from '../../../hooks/authHook';

export default async function updateUserArgsRoute(fastify: FastifyInstance) {
  fastify.patch<UpdateUserArgsRouteRequest>(
    '/teams/:teamId/mcp/installations/:installationId/user-configs/:configId/args',
    {
      schema: updateUserArgsSchema,
      preHandler: [authHook]
    },
    async (request: FastifyRequest<UpdateUserArgsRouteRequest>, reply: FastifyReply) => {
      const { teamId, installationId, configId } = request.params;
      const userId = request.user!.id;
      const { args } = request.body;

      try {
        // Update the user configuration args
        const updatedConfig = await mcpUserConfigurationService.updateUserArgs(
          configId,
          userId,
          teamId,
          args
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
          message: 'User configuration arguments updated successfully'
        });

      } catch (error) {
        fastify.log.error({
          operation: 'update_user_configuration_args',
          error,
          teamId,
          installationId,
          configId,
          userId
        }, 'Error updating user configuration args');
        
        // Handle validation errors
        if (error instanceof Error && (
          error.message.includes('required') || 
          error.message.includes('arguments')
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
