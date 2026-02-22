import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { initializeDatabase } from '../../db';
import { getDatabaseConfig, validateDatabaseConfig } from '../../db/config';
import { DbSetupRequestBodySchema, DatabaseType } from './schemas';
import fs from 'node:fs/promises';
import path from 'node:path';

const SETUP_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    restart_required: { type: 'boolean' },
    database_type: { type: 'string' }
  },
  required: ['message', 'restart_required', 'database_type']
} as const;

const SETUP_ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    error: { type: 'string' },
    details: {}
  },
  required: ['error']
} as const;

const SETUP_CONFLICT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    database_type: { type: 'string' }
  },
  required: ['message', 'database_type']
} as const;

// Route schema for OpenAPI documentation
const dbSetupRouteSchema = {
  tags: ['Database'],
  summary: 'Setup database',
  description: 'Initializes and configures the database for the DeployStack application. This endpoint sets up the database schema, creates necessary tables, and initializes database-dependent services. Can only be called once - subsequent calls will return a conflict error.',
  body: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: Object.values(DatabaseType) }
    },
    required: ['type'],
    additionalProperties: false
  },
  response: {
    200: {
      ...SETUP_SUCCESS_RESPONSE_SCHEMA,
      description: 'Database setup completed successfully'
    },
    400: {
      ...SETUP_ERROR_RESPONSE_SCHEMA,
      description: 'Bad Request - Invalid input or unsupported database type'
    },
    409: {
      ...SETUP_CONFLICT_RESPONSE_SCHEMA,
      description: 'Conflict - Database setup has already been performed'
    },
    500: {
      ...SETUP_ERROR_RESPONSE_SCHEMA,
      description: 'Internal Server Error - Database setup failed'
    }
  }
};

/**
 * Save database selection to persistent_data/db.selection.json
 */
async function saveDatabaseSelection(dbType: DatabaseType): Promise<void> {
  const persistentDataDir = path.join(process.cwd(), 'persistent_data');
  const selectionFile = path.join(persistentDataDir, 'db.selection.json');

  // Ensure persistent_data directory exists
  await fs.mkdir(persistentDataDir, { recursive: true });

  const selection = {
    type: dbType,
    selectedAt: new Date().toISOString(),
    version: '1.0'
  };

  await fs.writeFile(selectionFile, JSON.stringify(selection, null, 2), 'utf8');
}

/**
 * Check if database selection already exists
 */
async function getDatabaseSelection(): Promise<{ type: DatabaseType; selectedAt: string } | null> {
  try {
    const persistentDataDir = path.join(process.cwd(), 'persistent_data');
    const selectionFile = path.join(persistentDataDir, 'db.selection.json');

    const content = await fs.readFile(selectionFile, 'utf8');
    const selection = JSON.parse(content);

    return {
      type: selection.type as DatabaseType,
      selectedAt: selection.selectedAt
    };
  } catch {
    // File doesn't exist or is invalid
    return null;
  }
}

/**
 * Set environment variables for the selected database type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setDatabaseEnvironment(dbType: DatabaseType, logger?: any): void {
  // Clear any existing DB_TYPE
  delete process.env.DB_TYPE;

  // Set the selected database type
  process.env.DB_TYPE = dbType;

  if (logger) {
    logger.info({
      operation: 'set_database_environment',
      databaseType: dbType
    }, `Database type set to: ${dbType}`);
  }
}

// Handler for POST /api/db/setup
async function setupDbHandler(
  request: FastifyRequest,
  reply: FastifyReply,
  server: FastifyInstance
) {
  try {
    // Validate request body
    const parseResult = DbSetupRequestBodySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: parseResult.error.issues
      });
    }

    const { type: dbType } = parseResult.data;

    // Check if database is already configured
    const existingSelection = await getDatabaseSelection();
    if (existingSelection) {
      server.log.warn('Attempt to setup database when already configured.');
      const conflictResponse = {
        message: 'Database setup has already been performed.',
        database_type: String(existingSelection.type)
      };
      const jsonString = JSON.stringify(conflictResponse);
      return reply.status(409).type('application/json').send(jsonString);
    }

    // Validate that the selected database type has proper environment configuration
    setDatabaseEnvironment(dbType, server.log);

    let dbConfig;
    try {
      dbConfig = getDatabaseConfig(server.log);
    } catch (error) {
      const typedError = error as Error;
      server.log.error({ error: typedError.message }, 'Database configuration error:');
      return reply.status(400).send({
        error: 'Database configuration incomplete. Please check environment variables.',
        details: typedError.message
      });
    }

    // Validate configuration
    if (!validateDatabaseConfig(dbConfig)) {
      server.log.error('Invalid database configuration for selected type');
      return reply.status(400).send({
        error: `Invalid ${dbType} database configuration. Please check environment variables.`,
        details: `Database type: ${dbType}`
      });
    }

    server.log.info(`Setting up ${dbType} database...`);

    // Save the database selection
    await saveDatabaseSelection(dbType);
    server.log.info(`Database selection saved: ${dbType}`);

    // Initialize database
    const success = await initializeDatabase(request.log);

    if (success) {
      server.log.info('Database initialization successful.');

      try {
        // Re-initialize database-dependent services
        server.log.info('Re-initializing database-dependent services...');
        const reinitSuccess = await server.reinitializeDatabaseServices();

        if (reinitSuccess) {
          // Re-initialize plugins with database access
          server.log.info('Re-initializing plugins with database access...');
          await server.reinitializePluginsWithDatabase();

          server.log.info('Database setup and re-initialization completed successfully.');

          // Create a completely clean response object to avoid any serialization issues
          const cleanResponse = {
            message: 'Database setup successful. All services have been initialized and are ready to use.',
            restart_required: false,
            database_type: String(dbType)
          };

          // Send as raw JSON string to bypass any serialization issues
          const jsonString = JSON.stringify(cleanResponse);
          server.log.info({ response: jsonString }, 'Sending clean response:');
          return reply.status(200).type('application/json').send(jsonString);
        } else {
          server.log.warn('Database initialization succeeded but re-initialization failed. Manual restart may be required.');
          const responseObj = {
            message: 'Database setup successful, but some services may require a server restart to function properly.',
            restart_required: true,
            database_type: String(dbType)
          };
          server.log.info({ response: JSON.stringify(responseObj) }, 'Sending response object:');
          return reply.status(200).send(responseObj);
        }
      } catch (reinitError) {
        server.log.error({ error: reinitError }, 'Error during re-initialization after database setup:');
        return reply.status(200).send({
          message: 'Database setup successful, but re-initialization failed. Please restart the server to complete setup.',
          restart_required: true,
          database_type: String(dbType)
        });
      }
    } else {
      server.log.error('Database initialization failed.');
      return reply.status(500).send({
        error: 'Database initialization failed. Check server logs and configuration.'
      });
    }
  } catch (error) {
    const typedError = error as Error;
    server.log.error(typedError, `Error during database setup: ${typedError.message}`);
    return reply.status(500).send({
      error: `Database setup failed: ${typedError.message}`
    });
  }
}

// Fastify plugin to register the database setup route
export default async function dbSetupRoute(server: FastifyInstance) {
  server.post(
    '/db/setup',
    { schema: dbSetupRouteSchema },
    async (request, reply) => setupDbHandler(request, reply, server)
  );
}
