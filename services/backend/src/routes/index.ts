import { type FastifyInstance } from 'fastify'
// Import the individual database setup routes
import dbStatusRoute from './db/status'
import dbSetupRoute from './db/setup'

export const registerRoutes = (server: FastifyInstance): void => {
  // Register the individual database setup routes
  server.register(dbStatusRoute);
  server.register(dbSetupRoute);

  // Define a default route (example)
  server.get('/', async () => {
    // Ensure message points to the correct non-versioned API paths
    return { message: 'DeployStack Backend is running.' , status: server.db ? 'Database Connected' : 'Database Not Configured/Connected - Use /api/db/status and /api/db/setup' }
  })

  // Example of a route that might use the database
  server.get('/api/users-example', async (request, reply) => {
    if (!server.db) {
      return reply.status(503).send({ error: 'Database not configured or unavailable.' });
    }
    try {
      // This is a placeholder, actual user fetching would use server.db
      // e.g., const users = await server.db.select().from(...);
      // For now, just indicate it would use the DB.
      return { message: 'This route would fetch users from the database.', db_type: server.db.constructor.name };
    } catch (e) {
        const error = e as Error;
        server.log.error(error, 'Failed to fetch users example');
        return reply.status(500).send({ error: 'Failed to fetch users example' });
    }
  });
}
