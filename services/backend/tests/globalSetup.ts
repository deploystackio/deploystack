import { FastifyInstance } from 'fastify';
import { createTestServer } from '../src/test/testServer'; // Use simplified test server
import * as fs from 'fs-extra';
import * as path from 'path';
import { setTestContext } from './testContext';

const TEST_PORT = 3002; // Use a different port for testing
const PERSISTENT_DATA_PATH = path.join(__dirname, '..', 'persistent_data');
const DB_FILE_PATH = path.join(PERSISTENT_DATA_PATH, 'database', 'deploystack.db');
const DB_SELECTION_PATH = path.join(PERSISTENT_DATA_PATH, 'db.selection.json');

export default async function globalSetup() {
  try {
    // Set environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.PORT = String(TEST_PORT);
    process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-super-secret-key-for-jest';
    
    // Clean up persistent data before tests
    if (await fs.pathExists(DB_FILE_PATH)) {
      await fs.remove(DB_FILE_PATH);
    }
    if (await fs.pathExists(DB_SELECTION_PATH)) {
      await fs.remove(DB_SELECTION_PATH);
    }
    
    // Ensure the database directory exists
    await fs.ensureDir(path.join(PERSISTENT_DATA_PATH, 'database'));

    // Create simplified test server
    const server = await createTestServer();

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
