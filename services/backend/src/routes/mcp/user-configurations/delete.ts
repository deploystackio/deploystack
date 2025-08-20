import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { deleteUserConfigurationSchema, DeleteUserConfigurationRequest } from './schemas';
import { mcpUserConfigurationService } from '../../../services/mcpUserConfigurationService';
import { authHook } from '../../../hooks/authHook';

export default async function deleteUserConfigurationRoute(fastify: FastifyInstance) {
  fastify.delete<DeleteUserConfigurationRequest>(
    '/teams/:teamId/mcp/installations/:installationId/user-configs/:configId',
    {
      schema: deleteUserConfigurationSchema,
      preHandler: [authHook]
    },
    async (request: FastifyRequest<DeleteUserConfigurationRequest>, reply: FastifyReply) => {
      const { teamId, installationId, configId } = request.params;
      const userId = request.user!.id;

      try {
        // Delete the user configuration
        const deleted = await mcpUserConfigurationService.deleteUserConfiguration(
          configId,
          userId,
          teamId
        );

        if (!deleted) {
          return reply.status(404).send({
            error: 'User configuration not found'
          });
        }

        return reply.send({
          success: true,
          message: 'User configuration deleted successfully'
        });

      } catch (error) {
        fastify.log.error({
          operation: 'delete_user_configuration',
          error,
          teamId,
          installationId,
          configId,
          userId
        }, 'Error deleting user configuration');
        return reply.status(500).send({
          error: 'Internal server error'
        });
      }
    }
  );
}
