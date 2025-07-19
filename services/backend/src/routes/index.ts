import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createSchema } from 'zod-openapi'
import { getVersionString } from '../config/version'
import { GlobalSettings } from '../global-settings/helpers'
// Import the individual database setup routes
import dbStatusRoute from './db/status'
import dbSetupRoute from './db/setup'
// Import role and user management routes
import rolesRoute from './roles'
import usersRoute from './users'
// Import global settings routes
import globalSettingsRoute from './globalSettings'
// Import teams routes
import teamsRoute from './teams'
// Import cloud credentials routes
import cloudCredentialsRoute from './cloud-credentials'
// Import health check route
import healthRoute from './health'
// Import MCP routes
import mcpRoutes from './mcp'

// Response schema for the root health check endpoint
const healthCheckResponseSchema = z.object({
  message: z.string().describe('Service status message'),
  status: z.string().describe('Database connection status'),
  timestamp: z.string().describe('Current server timestamp'),
  version: z.string().optional().describe('API version (configurable via global.show_version setting)')
});

export const registerRoutes = (server: FastifyInstance): void => {
  // Register all API routes with centralized /api prefix
  server.register(async (apiInstance) => {
    // Register health check route
    await apiInstance.register(healthRoute);

    // Register the individual database setup routes
    await apiInstance.register(dbStatusRoute);
    await apiInstance.register(dbSetupRoute);
      
    // Register role and user management routes
    await apiInstance.register(rolesRoute);
    await apiInstance.register(usersRoute);
    
    // Register global settings routes
    await apiInstance.register(globalSettingsRoute);
    
    // Register teams routes
    await apiInstance.register(teamsRoute);
    
    // Register cloud credentials routes
    await apiInstance.register(cloudCredentialsRoute);
    
    // Register MCP routes
    await apiInstance.register(mcpRoutes);
  }, { prefix: '/api' });

  // Define a default route with comprehensive OpenAPI documentation
  server.get('/', {
    schema: {
      tags: ['Health Check'],
      summary: 'API health check',
      description: 'Returns the health status of the DeployStack Backend API, including database connection status and basic service information. This endpoint can be used for monitoring and health checks.',
      response: {
        200: createSchema(healthCheckResponseSchema.describe('API health check information'))
      }
    }
  }, async (request) => {
    // Check if version should be shown based on global setting
    const showVersion = await GlobalSettings.getBoolean('global.show_version', true);
    
    request.log.debug({
      operation: 'root_endpoint_version_check',
      showVersion,
      setting: 'global.show_version'
    }, 'Checking version display setting');

    // Build base response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: Record<string, any> = {
      message: 'DeployStack Backend is running.',
      status: server.db ? 'Database Connected' : 'Database Not Configured/Connected - Use /api/db/status and /api/db/setup',
      timestamp: new Date().toISOString()
    };

    // Conditionally include version based on global setting
    if (showVersion) {
      response.version = getVersionString();
      request.log.debug({
        operation: 'root_endpoint_response',
        includeVersion: true,
        version: response.version
      }, 'Including version in root endpoint response');
    } else {
      request.log.debug({
        operation: 'root_endpoint_response',
        includeVersion: false
      }, 'Version hidden from root endpoint response per global setting');
    }

    return response;
  })
}
