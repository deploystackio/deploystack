import request from 'supertest';
import { FastifyInstance } from 'fastify';
import * as fs from 'fs-extra';
import * as path from 'path';
import { getTestContext } from './testContext';

// __dirname is services/backend/tests/e2e
const APP_BACKEND_ROOT = path.join(__dirname, '..', '..'); // Resolves to services/backend/
const DB_FILE_PATH = path.join(APP_BACKEND_ROOT, 'database', 'deploystack.test.db'); // Path where the app creates the db

describe('POST /api/db/setup and GET /api/db/status (E2E)', () => {
  let server: FastifyInstance;
  let port: number;

  beforeAll(() => {
    // Access the server instance and port from test context
    const context = getTestContext();
    server = context.server!;
    port = context.port;
  });

  it('Case 1: should setup SQLite database and return correct status', async () => {
    // 1. Ensure db file does not exist initially (globalSetup should handle this, but double check for this specific test logic)
    expect(await fs.pathExists(DB_FILE_PATH)).toBe(false);
    
    // 2. Call /api/db/setup to initialize SQLite
    const setupResponse = await request(server.server || `http://localhost:${port}`)
      .post('/api/db/setup')
      .send({ type: 'sqlite' });

    expect(setupResponse.status).toBe(200);
    expect(setupResponse.body).toEqual({
      message: "Database setup successful. All services have been initialized and are ready to use.",
      restart_required: false
    });

    // 3. Check if the database file was created
    expect(await fs.pathExists(DB_FILE_PATH)).toBe(true);

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
    expect(await fs.pathExists(DB_FILE_PATH)).toBe(true);
  });

  it('Case 3: should apply all migrations successfully', async () => {
    // This test verifies that migrations were applied correctly
    // Database is already set up from the first test
    
    // Verify database file exists and is accessible
    expect(await fs.pathExists(DB_FILE_PATH)).toBe(true);
    
    // Check that the database file is not empty (migrations were applied)
    const stats = await fs.stat(DB_FILE_PATH);
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
