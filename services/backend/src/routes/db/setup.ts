import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { setupNewDatabase } from '../../db';
import { getDbConfig } from '../../db/config';
import { 
  InternalDbConfigSchema,
  DbSetupRequestBodySchema, 
  DatabaseType,
  type InternalDbConfig,
  type DbSetupRequestBody
} from './schemas';
import { ZodError } from 'zod';

// Handler for POST /api/db/setup
async function setupDbHandler(
  request: FastifyRequest<{ Body: DbSetupRequestBody }>,
  reply: FastifyReply,
  server: FastifyInstance
) {
  try {
    // Check if DB is already configured
    const existingConfig = await getDbConfig();
    if (existingConfig) {
      server.log.warn('Attempt to set up an already configured database.');
      return reply.status(409).send({ message: 'Database setup has already been performed.' });
    }

    const clientRequestBody = DbSetupRequestBodySchema.parse(request.body);
    
    let internalConfigObject: InternalDbConfig;
    const fixedSQLiteDbPath = 'persistent_data/database/deploystack.db';

    if (clientRequestBody.type === DatabaseType.SQLite) {
      internalConfigObject = { type: DatabaseType.SQLite, dbPath: fixedSQLiteDbPath };
    } else {
      return reply.status(400).send({ error: 'Invalid database type specified. Only SQLite is supported.' });
    }

    const validatedInternalConfig = InternalDbConfigSchema.parse(internalConfigObject);

    server.log.info(`Attempting to set up database with type: ${validatedInternalConfig.type}`);
    const success = await setupNewDatabase(validatedInternalConfig);
    if (success) {
      server.log.info('Database setup/initialization successful.');
      
      try {
        // Re-initialize database-dependent services
        server.log.info('Re-initializing database-dependent services...');
        const reinitSuccess = await server.reinitializeDatabaseServices();
        
        if (reinitSuccess) {
          // Re-initialize plugins with database access
          server.log.info('Re-initializing plugins with database access...');
          await server.reinitializePluginsWithDatabase();
          
          server.log.info('Database setup and re-initialization completed successfully.');
          return reply.status(200).send({ 
            message: 'Database setup successful. All services have been initialized and are ready to use.',
            restart_required: false
          });
        } else {
          server.log.warn('Database setup succeeded but re-initialization failed. Manual restart may be required.');
          return reply.status(200).send({ 
            message: 'Database setup successful, but some services may require a server restart to function properly.',
            restart_required: true
          });
        }
      } catch (reinitError) {
        server.log.error('Error during re-initialization after database setup:', reinitError);
        return reply.status(200).send({ 
          message: 'Database setup successful, but re-initialization failed. Please restart the server to complete setup.',
          restart_required: true
        });
      }
    } else {
      server.log.error('Database setup/initialization failed.');
      return reply.status(500).send({ message: 'Database setup failed. Check server logs.' });
    }
  } catch (error) {
    if (error instanceof ZodError) {
      server.log.warn(error, 'Validation error during database setup');
      return reply.status(400).send({ error: 'Invalid request body', details: error.errors });
    }
    const typedError = error as Error;
    server.log.error(typedError, `Error during database setup: ${typedError.message}`);
    return reply.status(500).send({ error: `Database setup failed: ${typedError.message}` });
  }
}

// Fastify plugin to register the /api/db/setup route
export default async function dbSetupRoute(server: FastifyInstance) {
  server.post<{ Body: DbSetupRequestBody }>(
    '/api/db/setup',
    // Removed Fastify's schema validation block to prevent conflict
    // as Zod validation is done manually within the handler.
    // If a Zod validator (like fastify-type-provider-zod) is configured
    // for Fastify, this block could be reinstated.
    async (request, reply) => setupDbHandler(request, reply, server)
  );
}
