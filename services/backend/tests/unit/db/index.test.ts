import { describe, it, expect, vi, beforeEach, afterEach, type Mocked, type MockedFunction } from 'vitest';
import type fs from 'node:fs'; // For types like PathLike, Dirent
import path from 'node:path';
import SqliteDriver from 'better-sqlite3';
import { drizzle as drizzleSqliteAdapter } from 'drizzle-orm/better-sqlite3';

// Modules to mock
import * as configModule from '../../../src/db/config';
import * as staticSchemaModule from '../../../src/db/schema.sqlite';

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
  type AnyDatabase,
  type AnySchema,
} from '../../../src/db/index';
import type { Plugin } from '../../../src/plugin-system/types';

// Create mock functions for fs/promises using vi.hoisted
const { mockMkdir, mockAccess, mockReadFile, mockReaddir, mockStat, mockDrizzleInstance } = vi.hoisted(() => ({
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
    // Make it more truthy by adding some properties that might be checked
    $schema: {},
    _: {},
  },
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

// Mock 'better-sqlite3'
const mockSqliteExec = vi.fn();
const mockSqlitePrepareRun = vi.fn();
const mockSqlitePrepareAll = vi.fn().mockReturnValue([]);
const mockSqlitePrepare = vi.fn().mockReturnValue({
  run: mockSqlitePrepareRun,
  all: mockSqlitePrepareAll,
});
const mockSqliteClose = vi.fn();
const mockSqliteInstance = {
  exec: mockSqliteExec,
  prepare: mockSqlitePrepare,
  close: mockSqliteClose,
};
vi.mock('better-sqlite3', () => {
  // Default export is the constructor
  return {
    default: vi.fn().mockImplementation(() => mockSqliteInstance),
  };
});

// Mock 'drizzle-orm/better-sqlite3'
vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: vi.fn().mockReturnValue(mockDrizzleInstance),
}));

// Mock './config'
vi.mock('../../../src/db/config', () => ({
  getDatabaseConfig: vi.fn(),
  validateDatabaseConfig: vi.fn(),
  getDatabaseStatus: vi.fn(),
}));

// Mock './schema.sqlite' (static schema)
vi.mock('../../../src/db/schema.sqlite', () => ({
  // Add mock static schema tables here if needed for generateSchema
  // e.g., authUser: {}, authSession: {}
  // For now, an empty object might suffice if generateSchema doesn't rely on specific props
  // from staticSchema for the core tests.
  pluginTableDefinitions: {}, // Start with empty plugin definitions
}));

const mockedGetDatabaseConfig = configModule.getDatabaseConfig as MockedFunction<typeof configModule.getDatabaseConfig>;
const mockedValidateDatabaseConfig = configModule.validateDatabaseConfig as MockedFunction<typeof configModule.validateDatabaseConfig>;
const mockedDrizzleSqliteAdapter = drizzleSqliteAdapter as Mocked<typeof drizzleSqliteAdapter>;
const MockedSqliteDriver = SqliteDriver as Mocked<typeof SqliteDriver>;

describe('Database Service (db/index.ts)', () => {
  let originalNodeEnv: string | undefined;
  let originalCwd: () => string;
  const testCwd = '/test/services/backend'; // Mock CWD

  beforeEach(() => {
    vi.resetAllMocks();
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    originalCwd = process.cwd;
    process.cwd = vi.fn(() => testCwd);

    // Reset global state within db/index.ts by re-evaluating parts of it or specific mocks
    // This is tricky because db/index.ts has module-level state.
    // For robust tests, the module might need a reset function, or tests need to be carefully ordered/isolated.
    // For now, we rely on mocks to control behavior.
    mockedGetDatabaseConfig.mockImplementation(() => {
      throw new Error('No database selection found. Please use the setup endpoint to configure a database.');
    });
    mockedValidateDatabaseConfig.mockReturnValue(false);
    
    // Default mocks for fs that might be called during init
    mockMkdir.mockResolvedValue(undefined);
    mockAccess.mockRejectedValueOnce(new Error('ENOENT')); // Default to DB file not existing
    mockReaddir.mockResolvedValue([]); // No migrations by default
    mockStat.mockResolvedValue({ isDirectory: () => true } as any);

    // Reset internal state trackers (if they were exposed for testing, otherwise this is harder)
    // Since they are not exposed, we test behavior that implies their state.
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.cwd = originalCwd;
    // Attempt to "reset" internal state by ensuring mocks reflect an uninitialized state
    // This is an indirect way to handle module-level state.
    // A more direct reset function in db/index.ts would be better.
    vi.resetModules(); // This can help, but use with caution as it re-imports modules.
                       // For this specific setup, it might be too broad.
                       // We'll rely on controlling mocks for state.
  });

  const sqliteConfig: configModule.DatabaseConfig = {
    type: 'sqlite',
    dbPath: 'persistent_data/database/deploystack.test.db',
  };

  // Create a mock logger for tests that need it
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => mockLogger),
  } as any;

  describe('initializeDatabase', () => {
    it('should return false if database is not configured', async () => {
      // The mock is already set up to throw an error for no database config
      const result = await initializeDatabase(mockLogger);
      expect(result).toBe(false);
      expect(getDbStatus().configured).toBe(false);
      expect(getDbStatus().initialized).toBe(false);
    });
  });

  describe('getDb and getSchema', () => {
    it('should throw if not initialized', async () => {
      // Ensure not initialized (default state of mocks)
      expect(() => getDb()).toThrow('Database not initialized');
      expect(() => getSchema()).toThrow('Database schema not generated');
    });
  });

  describe('registerPluginTables', () => {
    const plugin1: Plugin = {
      meta: { id: 'plugin1', name: 'Plugin 1', version: '1.0.0', description: '' },
      initialize: vi.fn(),
      databaseExtension: {
        tableDefinitions: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          myTable: { columnA: (builder: any) => builder.text('column_a') },
        },
      },
    };
    const plugin2: Plugin = {
      meta: { id: 'plugin2', name: 'Plugin 2', version: '1.0.0', description: '' },
      initialize: vi.fn(),
      // No databaseExtension
    };

    beforeEach(() => {
      // Reset pluginTableDefinitions from staticSchemaModule for each test
      // staticSchemaModule.pluginTableDefinitions = {}; // This causes a read-only error
      // Instead, clear the properties of the mocked object
      const ptd = staticSchemaModule.pluginTableDefinitions as Record<string, any>;
      for (const key in ptd) {
        delete ptd[key];
      }
    });

    it('should register table definitions from plugins', () => {
      registerPluginTables([plugin1, plugin2]);
      expect(staticSchemaModule.pluginTableDefinitions).toHaveProperty('plugin1_myTable');
      expect(staticSchemaModule.pluginTableDefinitions['plugin1_myTable']).toEqual(plugin1.databaseExtension?.tableDefinitions?.myTable);
      expect(Object.keys(staticSchemaModule.pluginTableDefinitions).length).toBe(1);
    });

    it('should handle plugins without database extensions', () => {
      registerPluginTables([plugin2]);
      expect(Object.keys(staticSchemaModule.pluginTableDefinitions).length).toBe(0);
    });

    it('should handle empty plugin array', () => {
      registerPluginTables([]);
      expect(Object.keys(staticSchemaModule.pluginTableDefinitions).length).toBe(0);
    });
  });

  describe('getDbStatus', () => {
    it('should return correct status when not configured', () => {
      const status = getDbStatus();
      expect(status.configured).toBe(false);
      expect(status.initialized).toBe(false);
      expect(status.dialect).toBe(null);
      expect(status.type).toBe(null);
    });
  });

  describe('executeDbOperation', () => {
    it('should throw when database is not initialized', () => {
      const operation = vi.fn();
      expect(() => executeDbOperation(operation)).toThrow('Database not initialized');
      expect(operation).not.toHaveBeenCalled();
    });
  });

  describe('initializeDatabase with valid config', () => {
    it('should successfully initialize with valid SQLite config', async () => {
      // Mock a successful configuration
      mockedGetDatabaseConfig.mockReturnValue(sqliteConfig);
      mockedValidateDatabaseConfig.mockReturnValue(true);
      
      // Mock successful file operations
      mockMkdir.mockResolvedValue(undefined);
      mockAccess.mockResolvedValue(undefined); // Directory exists
      mockReaddir.mockResolvedValue([]); // No migrations
      
      const result = await initializeDatabase(mockLogger);
      expect(result).toBe(true);
      expect(mockedGetDatabaseConfig).toHaveBeenCalledWith(mockLogger);
      expect(mockedValidateDatabaseConfig).toHaveBeenCalledWith(sqliteConfig);
    });
  });
});
