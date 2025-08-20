import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUserConfigurationByIdSchema, GetUserConfigurationByIdRequest, formatUserConfigResponse } from './schemas';
import { mcpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { authHook } from '../../../hooks/authHook';

export default async function getUserConfigurationRoute(fastify: FastifyInstance) {
  fastify.get<GetUserConfigurationByIdRequest>(
    '/teams/:teamId/mcp/installations/:installationId/user-configs/:configId',
    {
      schema: getUserConfigurationByIdSchema,
      preHandler: [authHook]
    },
    async (request: FastifyRequest<GetUserConfigurationByIdRequest>, reply: FastifyReply) => {
      const { teamId, installationId, configId } = request.params;
      const userId = request.user!.id;

      try {
        // Get the user configuration
        const userConfig = await mcpUserConfigurationService.getUserConfigurationById(
          configId,
          userId,
          teamId
        );

        if (!userConfig) {
          return reply.status(404).send({
            error: 'User configuration not found'
          });
        }

        // Format and return the response
        const response = formatUserConfigResponse(userConfig);
        return reply.send(response);

      } catch (error) {
        fastify.log.error({
          operation: 'get_user_configuration',
          error,
          teamId,
          installationId,
          configId,
          userId
        }, 'Error getting user configuration');
        return reply.status(500).send({
          error: 'Internal server error'
        });
      }
    }
  );
}
