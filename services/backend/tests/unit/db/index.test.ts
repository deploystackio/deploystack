import { describe, it, expect, vi, beforeEach, afterEach, type Mocked, type MockedFunction } from 'vitest';
import type fs from 'node:fs'; // For types like PathLike, Dirent
import path from 'node:path';
import SqliteDriver from 'better-sqlite3';
import { drizzle as drizzleSqliteAdapter } from 'drizzle-orm/better-sqlite3';

// Modules to mock
import * as configModule from '../../../src/db/config';
import * as staticSchemaModule from '../../../src/db/schema.sqlite';
import * as schemaModule from '../../../src/db/schema'; // For inputPluginTableDefinitions

// Functions from the module under test
import {
  initializeDatabase,
  setupNewDatabase,
  getDb,
  getSchema,
  getDbConnection,
  getDbStatus,
  regenerateSchema,
  registerPluginTables,
  // createPluginTables, // Not testing directly as it's complex and migration-focused
  // initializePluginDatabases, // Similar to createPluginTables
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
  getDbConfig: vi.fn(),
  saveDbConfig: vi.fn(),
}));

// Mock './schema.sqlite' (static schema)
vi.mock('../../../src/db/schema.sqlite', () => ({
  // Add mock static schema tables here if needed for generateSchema
  // e.g., authUser: {}, authSession: {}
  // For now, an empty object might suffice if generateSchema doesn't rely on specific props
  // from staticSchema for the core tests.
}));

// Mock './schema' for inputPluginTableDefinitions
vi.mock('../../../src/db/schema', () => ({
  pluginTableDefinitions: {}, // Start with empty plugin definitions
}));

const mockedGetDbConfig = configModule.getDbConfig as MockedFunction<typeof configModule.getDbConfig>;
const mockedSaveDbConfig = configModule.saveDbConfig as MockedFunction<typeof configModule.saveDbConfig>;
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
    mockedGetDbConfig.mockResolvedValue(null); // Default to not configured
    
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

  const sqliteConfig: configModule.SQLiteConfig = {
    type: 'sqlite',
    dbPath: 'persistent_data/database/deploystack.test.db',
  };

  describe('initializeDatabase', () => {
    it('should return false if database is not configured', async () => {
      mockedGetDbConfig.mockResolvedValue(null);
      const result = await initializeDatabase();
      expect(result).toBe(false);
      expect(getDbStatus().configured).toBe(false);
      expect(getDbStatus().initialized).toBe(false);
    });
  });

  describe('getDb, getSchema, getDbConnection', () => {
    it('should throw if not initialized', async () => {
      // Ensure not initialized (default state of mocks)
      expect(() => getDb()).toThrow('Database not initialized');
      expect(() => getSchema()).toThrow('Database schema not generated');
      expect(() => getDbConnection()).toThrow('Database connection not established');
    });
  });

  describe('regenerateSchema', () => {
    it('should not regenerate if not configured', async () => {
       mockedGetDbConfig.mockResolvedValue(null); // Not configured
       // Ensure it's not initialized either
       // (This state is hard to enforce perfectly without module reset)

       const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
       regenerateSchema();
       expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('regenerating'));
       consoleLogSpy.mockRestore();
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
      // Reset pluginTableDefinitions from schemaModule for each test
      // schemaModule.pluginTableDefinitions = {}; // This causes a read-only error
      // Instead, clear the properties of the mocked object
      const ptd = schemaModule.pluginTableDefinitions as Record<string, any>;
      for (const key in ptd) {
        delete ptd[key];
      }
    });

    it('should register table definitions from plugins', () => {
      registerPluginTables([plugin1, plugin2]);
      expect(schemaModule.pluginTableDefinitions).toHaveProperty('plugin1_myTable');
      expect(schemaModule.pluginTableDefinitions['plugin1_myTable']).toEqual(plugin1.databaseExtension?.tableDefinitions?.myTable);
      expect(Object.keys(schemaModule.pluginTableDefinitions).length).toBe(1);
    });
  });
});
