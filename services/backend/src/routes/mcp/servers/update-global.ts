import { type FastifyInstance } from 'fastify';
import { requireGlobalAdmin } from '../../../middleware/roleMiddleware';
import { McpCatalogService } from '../../../services/mcpCatalogService';
import { getDb } from '../../../db';
import { EVENT_NAMES } from '../../../events';
import type { EventContext } from '../../../events/types';
import {
  SERVER_ID_PARAM_SCHEMA,
  UPDATE_GLOBAL_SERVER_REQUEST_SCHEMA,
  UPDATE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA,
  COMMON_ERROR_RESPONSES,
  type ServerIdParams,
  type ErrorResponse,
  type ServerEntity,
  formatServerResponse
} from './schemas';

// TypeScript interface for update request
interface UpdateGlobalServerRequest {
  name?: string;
  description?: string;
  long_description?: string;
  repository_url?: string;
  repository_source?: string;
  repository_id?: string;
  repository_subfolder?: string;
  git_branch?: string;
  website_url?: string;
  github_account_id?: string;
  github_readme_base64?: string;
  language?: string;
  runtime?: string;
  transport_type?: 'stdio' | 'http' | 'sse';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packages?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remotes?: any[];
  resources?: Array<{ type: string; description: string; }>;
  prompts?: Array<{ name: string; description: string; }>;
  author_name?: string;
  author_contact?: string;
  organization?: string;
  license?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dependencies?: Record<string, any>;
  category_id?: string;
  tags?: string[];
  status?: 'active' | 'deprecated' | 'maintenance';
  featured?: boolean;
  auto_install_new_default_team?: boolean;
}

interface UpdateGlobalServerSuccessResponse {
  success: boolean;
  data: ServerEntity;
}

export default async function updateGlobalServer(server: FastifyInstance) {
  server.put('/mcp/servers/global/:id', {
    preValidation: requireGlobalAdmin(),
    schema: {
      tags: ['MCP Servers'],
      summary: 'Update global MCP server (Global Admin only)',
      description: 'Update an existing global MCP server - requires global admin permissions. Only global servers can be updated through this endpoint. Requires Content-Type: application/json header when sending request body.',
      security: [{ cookieAuth: [] }],
      
      params: SERVER_ID_PARAM_SCHEMA,
      body: UPDATE_GLOBAL_SERVER_REQUEST_SCHEMA,
      
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: UPDATE_GLOBAL_SERVER_REQUEST_SCHEMA
          }
        }
      },
      
      response: {
        200: {
          ...UPDATE_GLOBAL_SERVER_SUCCESS_RESPONSE_SCHEMA,
          description: 'Server updated successfully'
        },
        400: COMMON_ERROR_RESPONSES[400],
        401: COMMON_ERROR_RESPONSES[401],
        403: COMMON_ERROR_RESPONSES[403],
        404: COMMON_ERROR_RESPONSES[404],
        409: COMMON_ERROR_RESPONSES[409],
        500: COMMON_ERROR_RESPONSES[500]
      }
    }
  }, async (request, reply) => {
    const { id: serverId } = request.params as ServerIdParams;
    const updateData = request.body as UpdateGlobalServerRequest;
    
    request.log.info({
      operation: 'update_global_mcp_server',
      userId: request.user?.id,
      serverId,
      updateFields: Object.keys(updateData)
    }, 'Updating global MCP server');

    try {
      const db = getDb();
      const mcpService = new McpCatalogService(db, request.log);
      
      request.log.info({
        operation: 'update_global_mcp_server',
        step: 'start',
        serverId,
        updateData
      }, 'Starting update process');
      
      // First check if server exists and is global
      const existingServer = await mcpService.getServerById(serverId);
      request.log.info({
        operation: 'update_global_mcp_server',
        step: 'get_server',
        serverId,
        found: !!existingServer,
        visibility: existingServer?.visibility
      }, 'Retrieved existing server');
      
      if (!existingServer) {
        request.log.warn({
          operation: 'update_global_mcp_server',
          userId: request.user?.id,
          serverId
        }, 'Server not found');
        
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      if (existingServer.visibility !== 'global') {
        request.log.warn({
          operation: 'update_global_mcp_server',
          userId: request.user?.id,
          serverId,
          serverVisibility: existingServer.visibility
        }, 'Attempted to update non-global server through global endpoint');
        
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found or not a global server'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_global_mcp_server',
        step: 'calling_service',
        serverId,
        userId: request.user!.id
      }, 'Calling updateServer service method');

      const updatedServer = await mcpService.updateServer(
        serverId,
        request.user!.id,
        'global_admin', // We know user is global admin due to middleware
        updateData
      );
      
      request.log.info({
        operation: 'update_global_mcp_server',
        step: 'service_complete',
        serverId,
        success: !!updatedServer
      }, 'Service method completed');

      if (!updatedServer) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      request.log.info({
        operation: 'update_global_mcp_server',
        userId: request.user?.id,
        serverId,
        serverName: updatedServer.name,
        updatedFields: Object.keys(updateData)
      }, 'Global MCP server updated successfully');

      // Emit MCP_SERVER_UPDATED event
      try {
        const eventContext: EventContext = {
          db,
          logger: request.log,
          user: {
            id: request.user!.id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            email: (request.user as any).email,
            roleId: 'global_admin'
          },
          request: {
            ip: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: request.id
          },
          timestamp: new Date()
        };

        server.eventBus.emitWithContext(
          EVENT_NAMES.MCP_SERVER_UPDATED,
          {
            server: {
              id: updatedServer.id,
              name: updatedServer.name,
              description: updatedServer.description,
              language: updatedServer.language,
              runtime: updatedServer.runtime
            },
            updatedBy: {
              id: request.user!.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: (request.user as any).email
            },
            changes: updateData,
            metadata: {
              ip: request.ip
            }
          },
          eventContext
        );
        request.log.info(`MCP_SERVER_UPDATED event emitted for server: ${updatedServer.id}`);
      } catch (eventError) {
        request.log.error(eventError, `Failed to emit MCP_SERVER_UPDATED event for server ${updatedServer.id}:`);
        // Don't fail update if event emission fails
      }

      // Format the server response using the shared utility function
      let responseServer;
      try {
        responseServer = formatServerResponse(updatedServer);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (jsonError: any) {
        request.log.error({
          operation: 'update_global_mcp_server',
          userId: request.user?.id,
          serverId: updatedServer.id,
          jsonError
        }, 'Failed to parse JSON fields in response');
        
        const formatErrorResponse: ErrorResponse = {
          success: false,
          error: 'Failed to format server response'
        };
        const jsonString = JSON.stringify(formatErrorResponse);
        return reply.status(500).type('application/json').send(jsonString);
      }

      const response: UpdateGlobalServerSuccessResponse = {
        success: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: responseServer as any // Type assertion needed due to slight interface differences
      };

      // Manual JSON serialization
      const jsonString = JSON.stringify(response);
      return reply.status(200).type('application/json').send(jsonString);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      request.log.error({
        operation: 'update_global_mcp_server',
        userId: request.user?.id,
        serverId,
        error
      }, 'Failed to update global MCP server');

      // Handle specific error cases
      if (error.message?.includes('UNIQUE constraint failed') || 
          error.message?.includes('already exists') ||
          error.message?.includes('duplicate')) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server name already exists'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(409).type('application/json').send(jsonString);
      }

      if (error.message?.includes('Server not found')) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Server not found'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(404).type('application/json').send(jsonString);
      }

      if (error.message?.includes('Insufficient permissions')) {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'Global admin permissions required'
        };
        const jsonString = JSON.stringify(errorResponse);
        return reply.status(403).type('application/json').send(jsonString);
      }

      const errorResponse: ErrorResponse = {
        success: false,
        error: 'Failed to update global MCP server'
      };
      const jsonString = JSON.stringify(errorResponse);
      return reply.status(500).type('application/json').send(jsonString);
    }
  });
}
