import { createServer } from '../../src/server'; // Use main server
import * as fs from 'fs-extra';
import * as path from 'path';
import { setTestContext } from './testContext';

const TEST_PORT = 3002; // Use a different port for testing
// __dirname is services/backend/tests/e2e, so '..' goes to services/backend/tests, and another '..' goes to services/backend
const PERSISTENT_DATA_PATH = path.join(__dirname, '..', '..', 'persistent_data'); // Should resolve to services/backend/persistent_data

export default async function globalSetup() {
  try {
    // Set environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.PORT = String(TEST_PORT);
    process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-super-secret-key-for-jest';
    process.env.COOKIE_SECRET = 'test-cookie-secret-for-jest'; // Add cookie secret for tests
    process.env.DEPLOYSTACK_FRONTEND_URL = 'http://localhost:5174'; // Add dummy frontend URL for tests
    
    // Clean up the entire persistent_data directory for tests (for db.selection.test.json)
    if (await fs.pathExists(PERSISTENT_DATA_PATH)) {
      await fs.remove(PERSISTENT_DATA_PATH);
      console.log(`[TEST_SETUP_DEBUG] Removed directory: ${PERSISTENT_DATA_PATH}`);
    }
    await fs.ensureDir(PERSISTENT_DATA_PATH); // Ensure persistent_data directory itself exists
    console.log(`[TEST_SETUP_DEBUG] Ensured directory exists: ${PERSISTENT_DATA_PATH}`);

    // Define path to the test database directory
    const TEST_DB_DIR = path.join(__dirname, '..', '..', 'persistent_data', 'database-test'); // services/backend/persistent_data/database-test

    // Clean up the test database directory if it exists from a previous run
    if (await fs.pathExists(TEST_DB_DIR)) {
      await fs.remove(TEST_DB_DIR);
      console.log(`[TEST_SETUP_DEBUG] Removed test database directory: ${TEST_DB_DIR}`);
    }

    // IMPORTANT: The /api/db/setup endpoint, called by the first test,
    // will be responsible for creating db.selection.json and the actual
    // deploystack-{timestamp}.db file within the TEST_DB_DIR.
    // globalSetup.ts just ensures this directory is clean before tests run.

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
