# Backend End-to-End Testing

This document outlines the setup and execution of end-to-end (E2E) tests for the DeployStack backend.

## Overview

The E2E tests are designed to verify the functionality of the backend API endpoints, ensuring they behave as expected from an external perspective. This includes testing API responses, database interactions, and overall application flow.

## Testing Framework and Libraries

- **Jest**: A delightful JavaScript Testing Framework with a focus on simplicity. Used as the primary test runner and assertion library.
- **Supertest**: An HTTP assertion library that allows for easy testing of Node.js HTTP servers. Used to make requests to our Fastify backend and verify responses.
- **ts-jest**: A Jest transformer with source map support that lets you use Jest to test projects written in TypeScript.
- **fs-extra**: Used for file system operations needed during test setup (e.g., cleaning up database files).

## Prerequisites

Before running the tests, ensure you have installed all dependencies:

```bash
# Navigate to the backend service directory
cd services/backend

# Install dependencies (if you haven't already after recent changes)
npm install
```

## Test File Structure and Naming Convention

- All E2E test files are located in the `services/backend/tests/` directory.
- Test files must follow the naming convention: `<TEST_NAME>.e2e.test.ts`.
- Tests run sequentially in alphabetical order to ensure proper dependencies.

### Current Test Files (in execution order)

1. **`setup.e2e.test.ts`** - Database setup and initialization
2. **`user-registration.e2e.test.ts`** - User registration and role assignment
3. **`email-login.e2e.test.ts`** - Email login/logout and session management

## Running Tests

To execute the E2E test suite, run the following command from the `services/backend/` directory:

```bash
npm run test:backend
```

Alternatively, you can run it from the root project directory:

```bash
npm run test:backend
```

This command will:

1. Trigger Jest to find and execute all `*.e2e.test.ts` files within the `services/backend/tests/` directory.
2. Execute a global setup script (`services/backend/tests/globalSetup.ts`) before any tests run. This script:
   - Sets necessary environment variables for testing (e.g., `NODE_ENV=test`, a specific test port, a test encryption secret).
   - Clears any existing test database files (`persistent_data/database/deploystack.db` and `persistent_data/db.selection.json`) to ensure a clean state.
   - Programmatically starts the backend server on a dedicated test port.
3. Run the tests.
4. Execute a global teardown script (`services/backend/tests/globalTeardown.ts`) after all tests complete. This script stops the backend server.

## Environment Variables for Testing

The `globalSetup.ts` script automatically configures the following environment variables for the test run:

- `NODE_ENV`: set to `test`
- `PORT`: set to a dedicated test port (e.g., 3002)
- `DEPLOYSTACK_ENCRYPTION_SECRET`: set to a dummy secret (`test-super-secret-key-for-jest`)

## Writing New Tests

When adding new E2E tests:

1. Create a new file in `services/backend/tests/` following the `<TEST_NAME>.e2e.test.ts` naming convention.
2. Import `request` from `supertest` and the `FastifyInstance` type if needed.
3. Access the globally available test server instance via `global.__TEST_SERVER__`.
4. Use `describe` and `it` blocks from Jest to structure your tests.
5. Use `supertest` to make requests to your API:

    ```typescript
    import request from 'supertest';
    import { FastifyInstance } from 'fastify';

    describe('GET /api/some-endpoint', () => {
      let server: FastifyInstance;

      beforeAll(() => {
        server = global.__TEST_SERVER__;
      });

      it('should return a 200 OK for a valid request', async () => {
        const response = await request(server.server).get('/api/some-endpoint');
        expect(response.status).toBe(200);
        // Add more assertions on response.body, headers, etc.
      });
    });
    ```

6. Remember that `globalSetup.ts` cleans the database state before tests. If your tests rely on specific pre-existing data beyond the initial setup, you'll need to create that data within your test or a `beforeEach` block.

## Current Test Suites

### 1. `setup.e2e.test.ts`

- **Purpose**: Verifies the initial database setup functionality.
- **Key Checks**:
  - Ensures the test database file does not exist before setup.
  - Calls `POST /api/db/setup` with `{"type": "sqlite"}`.
  - Verifies the API response indicates successful setup initiation.
  - Checks that the SQLite database file (`persistent_data/database/deploystack.db`) is created.
  - Calls `GET /api/db/status` and verifies the response shows `configured: true`, `initialized: true`, and `dialect: "sqlite"`.
  - Validates global settings initialization without errors.
  - Confirms all migrations are applied successfully.
  - Tests proper error handling for duplicate setup attempts.

### 2. `user-registration.e2e.test.ts`

- **Purpose**: Tests user registration functionality and role assignment logic.
- **Key Checks**:
  - Registers the first user and verifies they receive `global_admin` role.
  - Registers a second user and verifies they receive `global_user` role.
  - Confirms both users exist in the database with correct roles.
  - Validates that default teams are created for both users.
  - Tests duplicate email and username prevention.
  - Stores user IDs and session cookies for subsequent tests.

### 3. `email-login.e2e.test.ts`

- **Purpose**: Tests email-based authentication, session management, and logout functionality.
- **Key Checks**:
  - Logs in both users with email and password.
  - Verifies user sessions exist and work correctly.
  - Tests invalid login attempts (wrong email/password).
  - Logs out both users and confirms session invalidation.
  - Verifies no active sessions remain after logout.
  - Tests graceful handling of logout without valid session.
  - Confirms users can re-login after logout.

## Troubleshooting

- **`Cannot find module 'supertest'` (or similar type errors)**: Ensure you have run `npm install` in the `services/backend` directory after the testing dependencies were added to `package.json`.
- **Port conflicts**: The tests run on a dedicated port (defaulted to 3002 in `globalSetup.ts`). Ensure this port is free.
- **Database state**: Tests are designed to run against a clean database. `globalSetup.ts` handles this. If you encounter issues related to database state, ensure no other processes are interfering with `services/backend/persistent_data/`.
