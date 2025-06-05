// globalTeardown.ts
import { FastifyInstance } from 'fastify';
import * as fs from 'fs-extra';
import * as path from 'path';

export default async function globalTeardown() {
  const server = global.__TEST_SERVER__ as FastifyInstance | undefined;

  try {
    // Close the test server
    if (server) {
      await server.close();
      console.log('\nTest server stopped.');
    }

    // Clean up test database and related files
    const APP_BACKEND_ROOT = path.join(__dirname, '..', '..'); // services/backend/
    const TEST_DATA_DIR = path.join(__dirname, 'test-data'); // services/backend/tests/e2e/test-data
    const TEST_DB_FILE = path.join(TEST_DATA_DIR, 'deploystack.test.db');
    const PERSISTENT_DATA_PATH = path.join(APP_BACKEND_ROOT, 'persistent_data');

    // Remove test database file if it exists
    if (await fs.pathExists(TEST_DB_FILE)) {
      await fs.remove(TEST_DB_FILE);
      console.log(`[TEST_TEARDOWN_DEBUG] Removed test database file: ${TEST_DB_FILE}`);
    }

    // Clean up persistent_data directory used for tests
    if (await fs.pathExists(PERSISTENT_DATA_PATH)) {
      await fs.remove(PERSISTENT_DATA_PATH);
      console.log(`[TEST_TEARDOWN_DEBUG] Removed test persistent data directory: ${PERSISTENT_DATA_PATH}`);
    }

    console.log('Test cleanup completed successfully.');
  } catch (error) {
    console.error('Error during test teardown:', error);
    // Don't throw the error to avoid masking test results
  }
}
