import { type FastifyInstance } from 'fastify'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { getVersionString } from '../config/version'
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

// Response schema for the root health check endpoint
const healthCheckResponseSchema = z.object({
  message: z.string().describe('Service status message'),
  status: z.string().describe('Database connection status'),
  timestamp: z.string().describe('Current server timestamp'),
  version: z.string().describe('API version')
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
  }, { prefix: '/api' });

  // Define a default route with comprehensive OpenAPI documentation
  server.get('/', {
    schema: {
      tags: ['Health Check'],
      summary: 'API health check',
      description: 'Returns the health status of the DeployStack Backend API, including database connection status and basic service information. This endpoint can be used for monitoring and health checks.',
      response: {
        200: zodToJsonSchema(healthCheckResponseSchema.describe('API health check information'), {
          $refStrategy: 'none',
          target: 'openApi3'
        })
      }
    }
  }, async () => {
    // Ensure message points to the correct non-versioned API paths
    return { 
      message: 'DeployStack Backend is running.',
      status: server.db ? 'Database Connected' : 'Database Not Configured/Connected - Use /api/db/status and /api/db/setup',
      timestamp: new Date().toISOString(),
      version: getVersionString()
    }
  })
}
