import request from 'supertest';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs-extra';
import * as path from 'path';
import { getTestContext } from './testContext';

// __dirname is services/backend/tests/e2e
const TEST_DB_DIR = path.join(__dirname, '..', '..', 'persistent_data', 'database-test'); // Resolves to services/backend/persistent_data/database-test

describe('POST /api/db/setup and GET /api/db/status (E2E)', () => {
  let server: FastifyInstance;
  let port: number;
  let dbFilePath: string;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('Case 1: should setup SQLite database and return correct status', async () => {
    // 1. Ensure test db directory is clean initially (globalSetup should handle this)
    expect(await fs.pathExists(TEST_DB_DIR)).toBe(false);
    
    // 2. Call /api/db/setup to initialize SQLite
    const setupResponse = await request(server.server || `http://localhost:${port}`)
      .post('/api/db/setup')
      .send({ type: 'sqlite' });

    expect(setupResponse.status).toBe(200);
    expect(setupResponse.body).toEqual({
      message: "Database setup successful. All services have been initialized and are ready to use.",
      restart_required: false,
      database_type: "sqlite"
    });

    // 3. Check if the database directory was created and find the database file
    expect(await fs.pathExists(TEST_DB_DIR)).toBe(true);
    
    // Find the database file with timestamp pattern
    const files = await fs.readdir(TEST_DB_DIR);
    const dbFile = files.find(file => file.startsWith('deploystack-') && file.endsWith('.db'));
    expect(dbFile).toBeDefined();
    
    dbFilePath = path.join(TEST_DB_DIR, dbFile!);
    expect(await fs.pathExists(dbFilePath)).toBe(true);

    // 4. Call /api/db/status to verify
    const statusResponse = await request(server.server || `http://localhost:${port}`)
      .get('/api/db/status');
    
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body).toEqual({
      configured: true,
      initialized: true,
      dialect: 'sqlite'
    });
  });

  it('Case 2: should initialize global settings without errors', async () => {
    // This test verifies that global settings initialization works properly
    // Since the database is already set up from the first test, we just verify the status
    
    const statusResponse = await request(server.server || `http://localhost:${port}`)
      .get('/api/db/status');
    
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.configured).toBe(true);
    expect(statusResponse.body.initialized).toBe(true);
    expect(statusResponse.body.dialect).toBe('sqlite');
    
    // Verify database file exists (global settings were created successfully)
    expect(await fs.pathExists(dbFilePath)).toBe(true);
  });

  it('Case 3: should apply all migrations successfully', async () => {
    // This test verifies that migrations were applied correctly
    // Database is already set up from the first test
    
    // Verify database file exists and is accessible
    expect(await fs.pathExists(dbFilePath)).toBe(true);
    
    // Check that the database file is not empty (migrations were applied)
    const stats = await fs.stat(dbFilePath);
    expect(stats.size).toBeGreaterThan(0);
    
    // Verify status shows properly initialized state
    const statusResponse = await request(server.server || `http://localhost:${port}`)
      .get('/api/db/status');
    
    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.configured).toBe(true);
    expect(statusResponse.body.initialized).toBe(true);
    expect(statusResponse.body.dialect).toBe('sqlite');
  });

  it('Case 4: should return 409 when trying to setup an already configured database', async () => {
    // This test verifies proper error handling for duplicate setup attempts
    
    const setupResponse = await request(server.server || `http://localhost:${port}`)
      .post('/api/db/setup')
      .send({ type: 'sqlite' });

    expect(setupResponse.status).toBe(409);
    // The exact error message may vary, but it should indicate the database is already configured
  });

  // Add more tests for other scenarios, e.g., trying to setup when already configured, invalid type, etc.
});
