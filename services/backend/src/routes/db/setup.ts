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
import { ZodError, z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Response schemas for different scenarios
const setupSuccessResponseSchema = z.object({
  message: z.string().describe('Success message indicating the database setup status.'),
  restart_required: z.boolean().describe('Indicates whether a server restart is required to complete the setup.')
});

const setupErrorResponseSchema = z.object({
  error: z.string().describe('Error message describing what went wrong.'),
  details: z.array(z.any()).optional().describe('Additional error details (validation errors).')
});

const setupConflictResponseSchema = z.object({
  message: z.string().describe('Message indicating that database setup has already been performed.')
});

// Route schema for OpenAPI documentation
const dbSetupRouteSchema = {
  tags: ['Database'],
  summary: 'Setup database',
  description: 'Initializes and configures the database for the DeployStack application. This endpoint sets up the database schema, creates necessary tables, and initializes database-dependent services. Can only be called once - subsequent calls will return a conflict error.',
  body: zodToJsonSchema(DbSetupRequestBodySchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    200: zodToJsonSchema(setupSuccessResponseSchema.describe('Database setup completed successfully'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    400: zodToJsonSchema(setupErrorResponseSchema.describe('Bad Request - Invalid input or unsupported database type'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    409: zodToJsonSchema(setupConflictResponseSchema.describe('Conflict - Database setup has already been performed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    }),
    500: zodToJsonSchema(setupErrorResponseSchema.describe('Internal Server Error - Database setup failed'), {
      $refStrategy: 'none',
      target: 'openApi3'
    })
  }
};

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

    // Fastify has already validated the request body using our Zod schema
    // If we reach here, request.body is guaranteed to be valid
    
    // Determine DB path based on environment
    const isTestEnv = process.env.NODE_ENV === 'test';
    const sqliteDbFileName = isTestEnv ? 'deploystack.test.db' : 'deploystack.db';
    // dbPath should be relative to services/backend
    // For tests, use the test-data directory; for production, use the database directory
    const sqliteDbPath = isTestEnv ? `tests/e2e/test-data/${sqliteDbFileName}` : `database/${sqliteDbFileName}`;

    // Since Zod validation ensures type is valid DatabaseType.SQLite, we can trust it
    const internalConfigObject: InternalDbConfig = { 
      type: DatabaseType.SQLite, 
      dbPath: sqliteDbPath 
    };

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
    { schema: dbSetupRouteSchema },
    async (request, reply) => setupDbHandler(request, reply, server)
  );
}
