import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { generateMigrations, applyMigrations } from '../../../src/db/migrations';
import type { FastifyBaseLogger } from 'fastify';

// Create mock functions using vi.hoisted
const { mockExec, mockDatabase, mockDrizzle, mockMigrate, mockAccess, mockClose } = vi.hoisted(() => ({
  mockExec: vi.fn(),
  mockDatabase: vi.fn(),
  mockDrizzle: vi.fn(),
  mockMigrate: vi.fn(),
  mockAccess: vi.fn(),
  mockClose: vi.fn(),
}));

// Mock the child_process module - we need to mock the callback version since it gets promisified
vi.mock('node:child_process', () => ({
  exec: vi.fn(),
}));

// Mock node:util to control the promisify behavior
vi.mock('node:util', () => ({
  promisify: vi.fn(() => mockExec),
}));

// Mock better-sqlite3
vi.mock('better-sqlite3', () => ({
  default: mockDatabase,
}));

// Mock drizzle-orm
vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: mockDrizzle,
}));

vi.mock('drizzle-orm/better-sqlite3/migrator', () => ({
  migrate: mockMigrate,
}));

// Mock fs/promises
vi.mock('node:fs/promises', () => ({
  default: {
    access: mockAccess,
  },
  access: mockAccess,
}));

describe('Database Migrations', () => {
  let mockLogger: FastifyBaseLogger;

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn(() => mockLogger),
      level: 'info',
      silent: false,
    } as any;
    
    // Setup default mock implementations
    mockDatabase.mockReturnValue({
      close: mockClose,
    });
    
    mockDrizzle.mockReturnValue({});
    mockMigrate.mockResolvedValue(undefined);
    mockAccess.mockResolvedValue(undefined);
    mockClose.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateMigrations', () => {
    const testSchemaPath = 'src/db/schema.ts';
    const testOutDir = 'drizzle/migrations';

    it('should execute drizzle-kit generate command successfully', async () => {
      const mockStdout = 'Migration generated successfully';
      const mockStderr = '';
      
      mockExec.mockResolvedValue({
        stdout: mockStdout,
        stderr: mockStderr,
      });

      await generateMigrations(testSchemaPath, testOutDir, mockLogger);

      expect(mockExec).toHaveBeenCalledWith(
        `npx drizzle-kit generate:sqlite --schema=${testSchemaPath} --out=${testOutDir}`
      );
      // In test mode, info logs are not called due to isTestMode() check
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should log stderr output when present', async () => {
      const mockStdout = 'Migration generated';
      const mockStderr = 'Warning: deprecated option used';
      
      mockExec.mockResolvedValue({
        stdout: mockStdout,
        stderr: mockStderr,
      });

      await generateMigrations(testSchemaPath, testOutDir, mockLogger);

      expect(mockLogger.error).toHaveBeenCalledWith({
        operation: 'generate_migrations',
        schemaPath: testSchemaPath,
        outDir: testOutDir,
        stderr: mockStderr
      }, 'Migration stderr output');
      // In test mode, info logs are not called due to isTestMode() check
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should handle and re-throw exec errors', async () => {
      const mockError = new Error('Command failed');
      mockExec.mockRejectedValue(mockError);

      await expect(generateMigrations(testSchemaPath, testOutDir, mockLogger)).rejects.toThrow(mockError);
      
      expect(mockLogger.error).toHaveBeenCalledWith({
        operation: 'generate_migrations',
        schemaPath: testSchemaPath,
        outDir: testOutDir,
        error: mockError
      }, 'Migration generation error');
    });

    it('should handle exec errors with stderr', async () => {
      const mockError = new Error('drizzle-kit not found');
      mockExec.mockRejectedValue(mockError);

      await expect(generateMigrations(testSchemaPath, testOutDir, mockLogger)).rejects.toThrow(mockError);
      
      expect(mockExec).toHaveBeenCalledWith(
        `npx drizzle-kit generate:sqlite --schema=${testSchemaPath} --out=${testOutDir}`
      );
      expect(mockLogger.error).toHaveBeenCalledWith({
        operation: 'generate_migrations',
        schemaPath: testSchemaPath,
        outDir: testOutDir,
        error: mockError
      }, 'Migration generation error');
    });
  });

  describe('applyMigrations', () => {
    const testDbPath = 'test.db';
    const testMigrationsDir = 'drizzle/migrations';
    let mockDbInstance: any;

    beforeEach(() => {
      mockDbInstance = {
        close: mockClose,
      };
      mockDatabase.mockReturnValue(mockDbInstance);
    });

    it('should apply migrations successfully', async () => {
      const mockDrizzleInstance = {};
      mockDrizzle.mockReturnValue(mockDrizzleInstance);
      mockAccess.mockResolvedValue(undefined);
      mockMigrate.mockResolvedValue(undefined);

      await applyMigrations(testDbPath, testMigrationsDir, mockLogger);

      expect(mockDatabase).toHaveBeenCalledWith(testDbPath);
      expect(mockDrizzle).toHaveBeenCalledWith(mockDbInstance);
      expect(mockAccess).toHaveBeenCalledWith(testMigrationsDir);
      expect(mockMigrate).toHaveBeenCalledWith(mockDrizzleInstance, { migrationsFolder: testMigrationsDir });
      expect(mockClose).toHaveBeenCalled();
      // In test mode, info logs are not called due to isTestMode() check
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should handle missing migrations directory', async () => {
      const accessError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      accessError.code = 'ENOENT';
      mockAccess.mockRejectedValue(accessError);

      await expect(applyMigrations(testDbPath, testMigrationsDir, mockLogger)).rejects.toThrow(accessError);

      expect(mockDatabase).toHaveBeenCalledWith(testDbPath);
      expect(mockAccess).toHaveBeenCalledWith(testMigrationsDir);
      expect(mockMigrate).not.toHaveBeenCalled();
      expect(mockClose).toHaveBeenCalled(); // Should still close the database
      expect(mockLogger.error).toHaveBeenCalledWith({
        operation: 'apply_migrations',
        dbPath: testDbPath,
        migrationsDir: testMigrationsDir,
        error: accessError
      }, 'Failed to apply migrations');
    });

    it('should handle migration application errors', async () => {
      const mockDrizzleInstance = {};
      const migrationError = new Error('Migration failed: syntax error');
      
      mockDrizzle.mockReturnValue(mockDrizzleInstance);
      mockAccess.mockResolvedValue(undefined);
      mockMigrate.mockRejectedValue(migrationError);

      await expect(applyMigrations(testDbPath, testMigrationsDir, mockLogger)).rejects.toThrow(migrationError);

      expect(mockDatabase).toHaveBeenCalledWith(testDbPath);
      expect(mockDrizzle).toHaveBeenCalledWith(mockDbInstance);
      expect(mockAccess).toHaveBeenCalledWith(testMigrationsDir);
      expect(mockMigrate).toHaveBeenCalledWith(mockDrizzleInstance, { migrationsFolder: testMigrationsDir });
      expect(mockClose).toHaveBeenCalled(); // Should still close the database
      expect(mockLogger.error).toHaveBeenCalledWith({
        operation: 'apply_migrations',
        dbPath: testDbPath,
        migrationsDir: testMigrationsDir,
        error: migrationError
      }, 'Failed to apply migrations');
    });

    it('should handle database connection errors', async () => {
      const dbError = new Error('Database connection failed');
      mockDatabase.mockImplementation(() => {
        throw dbError;
      });

      await expect(applyMigrations(testDbPath, testMigrationsDir, mockLogger)).rejects.toThrow(dbError);

      expect(mockDatabase).toHaveBeenCalledWith(testDbPath);
      expect(mockDrizzle).not.toHaveBeenCalled();
      expect(mockAccess).not.toHaveBeenCalled();
      expect(mockMigrate).not.toHaveBeenCalled();
      // mockClose should not be called since database creation failed
    });

    it('should ensure database is closed even if migration fails', async () => {
      const mockDrizzleInstance = {};
      const migrationError = new Error('Migration failed');
      
      mockDrizzle.mockReturnValue(mockDrizzleInstance);
      mockAccess.mockResolvedValue(undefined);
      mockMigrate.mockRejectedValue(migrationError);

      await expect(applyMigrations(testDbPath, testMigrationsDir, mockLogger)).rejects.toThrow(migrationError);

      // Verify database is closed in finally block
      expect(mockClose).toHaveBeenCalled();
    });

    it('should ensure database is closed even if access check fails', async () => {
      const accessError = new Error('Permission denied');
      mockAccess.mockRejectedValue(accessError);

      await expect(applyMigrations(testDbPath, testMigrationsDir, mockLogger)).rejects.toThrow(accessError);

      // Verify database is closed in finally block
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete migration workflow', async () => {
      // Test generateMigrations followed by applyMigrations
      const schemaPath = 'src/db/schema.ts';
      const outDir = 'drizzle/migrations';
      const dbPath = 'test.db';
      
      // Mock successful generation
      mockExec.mockResolvedValue({
        stdout: 'Migration files generated',
        stderr: '',
      });

      // Mock successful application
      const mockDrizzleInstance = {};
      mockDrizzle.mockReturnValue(mockDrizzleInstance);
      mockAccess.mockResolvedValue(undefined);
      mockMigrate.mockResolvedValue(undefined);

      // Generate migrations
      await generateMigrations(schemaPath, outDir, mockLogger);
      
      // Apply migrations
      await applyMigrations(dbPath, outDir, mockLogger);

      expect(mockExec).toHaveBeenCalledWith(
        `npx drizzle-kit generate:sqlite --schema=${schemaPath} --out=${outDir}`
      );
      expect(mockMigrate).toHaveBeenCalledWith(mockDrizzleInstance, { migrationsFolder: outDir });
      // In test mode, info logs are not called due to isTestMode() check
      expect(mockLogger.info).not.toHaveBeenCalled();
    });
  });
});
