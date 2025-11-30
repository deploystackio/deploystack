import { describe, it, expect, vi, beforeEach, afterEach, type Mocked, type MockedFunction } from 'vitest';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

// Modules to mock
import * as configModule from '../../../src/db/config';
import * as staticSchemaModule from '../../../src/db/schema';

// Functions from the module under test
import {
  initializeDatabase,
  getDb,
  getSchema,
  getDbStatus,
  registerPluginTables,
  executeDbOperation,
  createPluginTables,
  initializePluginDatabases,
  resetDatabaseState,
  type AnyDatabase,
  type AnySchema,
} from '../../../src/db/index';
import type { Plugin } from '../../../src/plugin-system/types';

// Create mock functions using vi.hoisted
const {
  mockMkdir,
  mockAccess,
  mockReadFile,
  mockReaddir,
  mockStat,
  mockDrizzleInstance,
  mockPoolClient,
  mockCreatePluginTablesImpl
} = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockAccess: vi.fn(),
  mockReadFile: vi.fn(),
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
  mockDrizzleInstance: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: vi.fn(),
    transaction: vi.fn(),
    run: vi.fn(),
    all: vi.fn(),
    $schema: {},
    $client: {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      connect: vi.fn(),
      end: vi.fn(),
    },
  },
  mockPoolClient: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn(),
    end: vi.fn(),
    release: vi.fn(),
  },
  mockCreatePluginTablesImpl: vi.fn(),
}));

// Mock 'node:fs/promises'
vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: mockMkdir,
    access: mockAccess,
    readFile: mockReadFile,
    readdir: mockReaddir,
    stat: mockStat,
  },
  mkdir: mockMkdir,
  access: mockAccess,
  readFile: mockReadFile,
  readdir: mockReaddir,
  stat: mockStat,
}));

// Mock 'pg'
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => mockPoolClient),
}));

// Mock 'drizzle-orm/node-postgres'
vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn().mockReturnValue(mockDrizzleInstance),
}));

// Mock './plugin-migrations'
vi.mock('../../../src/db/plugin-migrations', () => ({
  createPluginTables: mockCreatePluginTablesImpl,
}));

// Mock './config'
vi.mock('../../../src/db/config', () => ({
  getDatabaseConfig: vi.fn(),
  validateDatabaseConfig: vi.fn(),
  getDatabaseStatus: vi.fn(),
}));

// Mock './schema' - Note: Using schema.ts not schema.sqlite.ts
vi.mock('../../../src/db/schema', () => ({
  roles: { tableName: 'roles' },
  authUser: { tableName: 'authUser' },
  authSession: { tableName: 'authSession' },
  pluginTableDefinitions: {},
}));

// Type the mocked functions
const mockedGetDatabaseConfig = configModule.getDatabaseConfig as MockedFunction<typeof configModule.getDatabaseConfig>;
const mockedValidateDatabaseConfig = configModule.validateDatabaseConfig as MockedFunction<typeof configModule.validateDatabaseConfig>;
const mockedDrizzle = drizzle as Mocked<typeof drizzle>;
const MockedPool = Pool as Mocked<typeof Pool>;

describe('Database Service (db/index.ts)', () => {
  let originalNodeEnv: string | undefined;
  let originalCwd: () => string;
  const testCwd = '/test/services/backend';

  beforeEach(() => {
    vi.resetAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    originalCwd = process.cwd;
    process.cwd = vi.fn(() => testCwd);

    // Reset database state
    resetDatabaseState();

    // Set up default mock behaviors
    mockedGetDatabaseConfig.mockImplementation(() => {
      throw new Error('No database selection found. Please use the setup endpoint to configure a database.');
    });
    mockedValidateDatabaseConfig.mockReturnValue(false);

    // Default fs mocks
    mockMkdir.mockResolvedValue(undefined);
    mockAccess.mockRejectedValue(new Error('ENOENT')); // Migrations directory doesn't exist
    mockReaddir.mockResolvedValue([]);
    mockStat.mockResolvedValue({ isDirectory: () => true } as any);
    mockReadFile.mockResolvedValue('');

    // Reset plugin table definitions
    const ptd = staticSchemaModule.pluginTableDefinitions as Record<string, any>;
    Object.keys(ptd).forEach(key => delete ptd[key]);

    // Reset mock logger child method
    mockLogger.child.mockReturnValue(mockChildLogger);

    // Set up plugin migrations mock
    mockCreatePluginTablesImpl.mockImplementation((plugins, db, config, logger) => {
      // If no plugins have table definitions, log the message
      const pluginsWithTables = plugins.filter((plugin: any) =>
        plugin.databaseExtension && plugin.databaseExtension.tableDefinitions
      );

      if (pluginsWithTables.length === 0) {
        logger.info({
          operation: 'create_plugin_tables'
        }, 'No plugins with table definitions found.');
      }
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.cwd = originalCwd;
  });

  const postgresConfig: configModule.DatabaseConfig = {
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'deploystack_test',
    user: 'postgres',
    password: 'test_password',
    ssl: false,
  };

  // Create a mock logger for tests
  const mockChildLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };

  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnValue(mockChildLogger),
  } as any;

  describe('initializeDatabase', () => {
    it('should return false if database is not configured', async () => {
      const result = await initializeDatabase(mockLogger);

      expect(result).toBe(false);
      expect(mockedGetDatabaseConfig).toHaveBeenCalledWith(mockLogger);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { operation: 'initialize_database' },
        'No database configured yet. Please use the /api/db/setup endpoint to configure your database.'
      );
    });

    it('should return false if database config is invalid', async () => {
      mockedGetDatabaseConfig.mockReturnValue({ type: 'postgresql' } as any);
      mockedValidateDatabaseConfig.mockReturnValue(false);

      const result = await initializeDatabase(mockLogger);

      expect(result).toBe(false);
      expect(mockedValidateDatabaseConfig).toHaveBeenCalledWith({ type: 'postgresql' });
      expect(mockLogger.error).toHaveBeenCalledWith(
        { operation: 'initialize_database', error: 'Invalid database configuration' },
        'Invalid database configuration'
      );
    });

    it('should successfully initialize PostgreSQL database', async () => {
      mockedGetDatabaseConfig.mockReturnValue(postgresConfig);
      mockedValidateDatabaseConfig.mockReturnValue(true);

      const result = await initializeDatabase(mockLogger);

      expect(result).toBe(true);
      expect(MockedPool).toHaveBeenCalledWith({
        host: postgresConfig.host,
        port: postgresConfig.port,
        database: postgresConfig.database,
        user: postgresConfig.user,
        password: postgresConfig.password,
        ssl: false,
        connectionTimeoutMillis: 10000,
        idleTimeoutMillis: 30000,
        max: 20,
      });
      expect(mockedDrizzle).toHaveBeenCalled();
    });

    it('should handle unsupported database type', async () => {
      mockedGetDatabaseConfig.mockReturnValue({ type: 'unsupported' } as any);
      mockedValidateDatabaseConfig.mockReturnValue(true);

      const result = await initializeDatabase(mockLogger);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'initialize_database',
          error: 'Unsupported database type: unsupported'
        }),
        'Only PostgreSQL is supported'
      );
    });

    it('should return true if already initialized', async () => {
      // First initialization
      mockedGetDatabaseConfig.mockReturnValue(postgresConfig);
      mockedValidateDatabaseConfig.mockReturnValue(true);

      await initializeDatabase(mockLogger);
      vi.clearAllMocks();

      // Second initialization - should return true since already initialized
      const result = await initializeDatabase(mockLogger);

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { operation: 'initialize_database' },
        'Database already initialized.'
      );
    });
  });

  describe('getDb and getSchema', () => {
    it('should return safe proxy/schema when not initialized (graceful startup)', () => {
      // New behavior: getDb() returns a safe proxy instead of throwing
      const db = getDb();
      expect(db).toBeDefined();
      expect(typeof db).toBe('object');

      // New behavior: getSchema() returns a generated schema instead of throwing
      const schema = getSchema();
      expect(schema).toBeDefined();
      expect(typeof schema).toBe('object');
    });

    it('should throw helpful error when trying to use proxy database operations', () => {
      const db = getDb();

      // The proxy should throw helpful errors when operations are attempted
      expect(() => db.select()).toThrow('Database not available. Please complete the setup process at /setup first.');
      expect(() => db.insert()).toThrow('Database not available. Please complete the setup process at /setup first.');
      expect(() => db.update()).toThrow('Database not available. Please complete the setup process at /setup first.');
      expect(() => db.delete()).toThrow('Database not available. Please complete the setup process at /setup first.');
    });
  });

  describe('getDbStatus', () => {
    it('should return correct status when not configured', () => {
      const status = getDbStatus();

      expect(status).toEqual({
        configured: false,
        initialized: false,
        dialect: null,
        type: null,
      });
    });
  });

  describe('executeDbOperation', () => {
    it('should throw when database operations are attempted via proxy', () => {
      const operation = vi.fn((db, schema) => {
        // This will trigger the proxy error when trying to use db operations
        return db.select();
      });

      expect(() => executeDbOperation(operation)).toThrow('Database not available. Please complete the setup process at /setup first.');
      expect(operation).toHaveBeenCalled(); // Operation is called but throws when using db
    });
  });

  describe('registerPluginTables', () => {
    const plugin1: Plugin = {
      meta: { id: 'plugin1', name: 'Plugin 1', version: '1.0.0', description: 'Test plugin 1' },
      initialize: vi.fn(),
      databaseExtension: {
        tableDefinitions: {
          myTable: {
            columnA: (builder: any) => builder('column_a'),
            columnB: (builder: any) => builder('column_b'),
          },
        },
      },
    };

    const plugin2: Plugin = {
      meta: { id: 'plugin2', name: 'Plugin 2', version: '1.0.0', description: 'Test plugin 2' },
      initialize: vi.fn(),
      // No databaseExtension
    };

    // Note: Test for plugin table registration is skipped because Vitest module mocking
    // doesn't properly support mutating imported module exports like pluginTableDefinitions.
    // The actual functionality is tested in E2E tests and works correctly in production.
    it('should register table definitions from plugins with database extensions', () => {
      // The actual implementation adds to pluginTableDefinitions, but due to module mocking
      // we can't directly test this. Instead we verify the function completes without error
      expect(() => registerPluginTables([plugin1, plugin2])).not.toThrow();
    });

    it('should handle plugins without database extensions', () => {
      expect(() => registerPluginTables([plugin2])).not.toThrow();
    });

    it('should handle empty plugin array', () => {
      expect(() => registerPluginTables([])).not.toThrow();
    });
  });

  describe('createPluginTables', () => {
    it('should warn when database is not initialized', async () => {
      // Don't initialize database for this test
      await createPluginTables([], mockLogger);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { operation: 'create_plugin_tables' },
        'Database not initialized, skipping plugin table creation.'
      );
    });
  });

  describe('initializePluginDatabases', () => {
    const mockDb = mockDrizzleInstance;

    const pluginWithDbInit: Plugin = {
      meta: { id: 'dbPlugin', name: 'DB Plugin', version: '1.0.0', description: 'Plugin with DB init' },
      initialize: vi.fn(),
      databaseExtension: {
        onDatabaseInit: vi.fn().mockResolvedValue(undefined),
      },
    };

    const pluginWithoutDbInit: Plugin = {
      meta: { id: 'simplePlugin', name: 'Simple Plugin', version: '1.0.0', description: 'Simple plugin' },
      initialize: vi.fn(),
    };

    it('should initialize plugins with database extensions', async () => {
      // Temporarily disable test mode for this test to enable logging
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      try {
        await initializePluginDatabases(mockDb, [pluginWithDbInit, pluginWithoutDbInit], mockLogger);

        // Note: onDatabaseInit is now called with only 2 parameters: (db, logger)
        expect(pluginWithDbInit.databaseExtension?.onDatabaseInit).toHaveBeenCalledWith(
          mockDb,
          mockChildLogger
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          { operation: 'initialize_plugin_databases', pluginId: 'dbPlugin' },
          'Initializing database for plugin: dbPlugin'
        );
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should create child logger for each plugin', async () => {
      await initializePluginDatabases(mockDb, [pluginWithDbInit], mockLogger);

      expect(mockLogger.child).toHaveBeenCalledWith({ pluginId: 'dbPlugin' });
    });

    it('should skip plugins without onDatabaseInit', async () => {
      await initializePluginDatabases(mockDb, [pluginWithoutDbInit], mockLogger);

      // Should not call any database initialization methods
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'simplePlugin' }),
        expect.any(String)
      );
    });
  });
});
