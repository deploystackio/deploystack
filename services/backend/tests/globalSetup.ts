import { FastifyInstance } from 'fastify';
import { createServer } from '../src/server'; // Use main server
import * as fs from 'fs-extra';
import * as path from 'path';
import { setTestContext } from './testContext';

const TEST_PORT = 3002; // Use a different port for testing
const PERSISTENT_DATA_PATH = path.join(__dirname, '..', 'persistent_data'); // This is services/backend/persistent_data
const TEST_DB_FILE_PATH = path.join(PERSISTENT_DATA_PATH, 'database', 'deploystack.test.db'); // Test-specific DB
const TEST_DB_SELECTION_PATH = path.join(PERSISTENT_DATA_PATH, 'db.selection.test.json'); // Test-specific selection

export default async function globalSetup() {
  try {
    // Set environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.PORT = String(TEST_PORT);
    process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-super-secret-key-for-jest';
    process.env.COOKIE_SECRET = 'test-cookie-secret-for-jest'; // Add cookie secret for tests
    process.env.DEPLOYSTACK_FRONTEND_URL = 'http://localhost:5174'; // Add dummy frontend URL for tests
    
    // Clean up persistent data before tests
    if (await fs.pathExists(TEST_DB_FILE_PATH)) {
      await fs.remove(TEST_DB_FILE_PATH);
    }
    if (await fs.pathExists(TEST_DB_SELECTION_PATH)) {
      await fs.remove(TEST_DB_SELECTION_PATH);
    }
    
    // Ensure the database directory exists (it's shared, but files are separate)
    await fs.ensureDir(path.join(PERSISTENT_DATA_PATH, 'database'));

    // IMPORTANT: We need to tell the application to USE this test database file.
    // The db/config.ts now uses 'db.selection.test.json' when NODE_ENV is 'test'.
    // globalSetup.ts deletes this file, so the DB system will likely see no config.
    // The db/index.ts or related setup logic should handle creating/using the
    // 'deploystack.test.db' when in test mode and no db.selection.test.json is found.
    // The line `process.env.DB_FILE_NAME = 'deploystack.test.db';` was removed as db/config.ts doesn't use it.

    // Create main server instance for testing
    const server = await createServer();

    // Start the server
    await server.listen({ port: TEST_PORT, host: '0.0.0.0' });

    // Set both global variables (for backward compatibility) and test context
    global.__TEST_SERVER__ = server;
    global.__TEST_PORT__ = TEST_PORT;
    
    setTestContext({
      server,
      port: TEST_PORT
    });
  } catch (error) {
    console.error('GlobalSetup failed:', error);
    console.error('Error stack:', (error as Error).stack);
    throw error; // Re-throw to make Jest report the failure
  }
}
