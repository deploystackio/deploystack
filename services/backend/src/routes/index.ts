import { type FastifyInstance } from 'fastify'
// Import the individual database setup routes
import dbStatusRoute from './db/status'
import dbSetupRoute from './db/setup'
// Import role and user management routes
import rolesRoute from './roles'
import usersRoute from './users'
// Import global settings routes
import globalSettingsRoute from './globalSettings'

export const registerRoutes = (server: FastifyInstance): void => {
  // Register the individual database setup routes
  server.register(dbStatusRoute);
  server.register(dbSetupRoute);
    
  // Register role and user management routes
  server.register(rolesRoute);
  server.register(usersRoute);
  
  // Register global settings routes
  server.register(globalSettingsRoute);

  // Define a default route
  server.get('/', async () => {
    // Ensure message points to the correct non-versioned API paths
    return { message: 'DeployStack Backend is running.' , status: server.db ? 'Database Connected' : 'Database Not Configured/Connected - Use /api/db/status and /api/db/setup' }
  })
}
