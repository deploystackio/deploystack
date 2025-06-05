import { FastifyInstance } from 'fastify';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface TestContext {
  server?: FastifyInstance;
  port: number;
  firstUserId?: string;
  firstUserCookie?: string;
  secondUserId?: string;
  secondUserCookie?: string;
  firstUserLoginCookie?: string;
  secondUserLoginCookie?: string;
}

const CONTEXT_FILE = path.join(__dirname, '.test-context.json');

// Global context for in-memory sharing within the same process
let testContext: TestContext | null = null;

export function setTestContext(context: TestContext): void {
  testContext = context;
  // Also save to file for cross-process sharing
  try {
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify({
      port: context.port,
      firstUserId: context.firstUserId,
      firstUserCookie: context.firstUserCookie,
      secondUserId: context.secondUserId,
      secondUserCookie: context.secondUserCookie,
      firstUserLoginCookie: context.firstUserLoginCookie,
      secondUserLoginCookie: context.secondUserLoginCookie,
    }, null, 2));
  } catch (error) {
    console.warn('Failed to save test context to file:', error);
  }
}

export function getTestContext(): TestContext {
  // First try in-memory context
  if (testContext && testContext.server) {
    return testContext;
  }

  // Try to load context from file first (more reliable in Jest)
  if (fs.existsSync(CONTEXT_FILE)) {
    try {
      const fileContext = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'));
      
      // Create a new server connection using the port from file
      if (fileContext.port) {
        const context: TestContext = {
          port: fileContext.port,
          ...fileContext
        };
        
        // Try to get server from global variables if available
        if (global.__TEST_SERVER__) {
          context.server = global.__TEST_SERVER__;
        } else {
          // Create a server-like object that supertest can use
          // This allows tests to work even when global variables aren't set
          const serverProxy = {
            server: `http://localhost:${fileContext.port}`,
            address: () => ({ port: fileContext.port })
          };
          context.server = serverProxy as any;
        }
        
        testContext = context;
        return context;
      }
    } catch (error) {
      console.warn('Failed to load test context from file:', error);
    }
  }

  // Fall back to global variables (set by globalSetup)
  if (global.__TEST_SERVER__ && global.__TEST_PORT__) {
    const context: TestContext = {
      server: global.__TEST_SERVER__,
      port: global.__TEST_PORT__,
    };

    testContext = context;
    return context;
  }

  // Enhanced error reporting
  console.error('Test context initialization failed!');
  console.error('Global __TEST_SERVER__ exists:', !!global.__TEST_SERVER__);
  console.error('Global __TEST_PORT__ exists:', !!global.__TEST_PORT__);
  console.error('In-memory testContext exists:', !!testContext);
  console.error('Context file exists:', fs.existsSync(CONTEXT_FILE));
  
  if (fs.existsSync(CONTEXT_FILE)) {
    try {
      const fileContent = fs.readFileSync(CONTEXT_FILE, 'utf8');
      console.error('Context file content:', fileContent);
    } catch (error) {
      console.error('Failed to read context file:', error);
    }
  }
  
  throw new Error('Test context not initialized. globalSetup did not run or failed.');
}

export function updateTestContext(updates: Partial<TestContext>): void {
  const context = getTestContext();
  Object.assign(context, updates);
  
  // Update in-memory context
  testContext = context;
  
  // Update file context
  try {
    const fileContext = fs.existsSync(CONTEXT_FILE) 
      ? JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf8'))
      : {};
    Object.assign(fileContext, updates);
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(fileContext, null, 2));
  } catch (error) {
    console.warn('Failed to update test context file:', error);
  }
}

// Clean up context file on process exit
process.on('exit', () => {
  try {
    if (fs.existsSync(CONTEXT_FILE)) {
      fs.unlinkSync(CONTEXT_FILE);
    }
  } catch (error) {
    // Ignore cleanup errors
  }
});
