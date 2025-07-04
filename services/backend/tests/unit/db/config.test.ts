import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateDatabaseConfig, getDatabaseStatus } from '../../../src/db/config';
import type { DatabaseConfig } from '../../../src/db/config';

describe('Database Configuration', () => {
  let originalEnv: string | undefined;
  let originalDbType: string | undefined;
  let originalSqliteDbPath: string | undefined;
  let originalTursoUrl: string | undefined;
  let originalTursoToken: string | undefined;

  beforeEach(() => {
    // Store original environment variables
    originalEnv = process.env.NODE_ENV;
    originalDbType = process.env.DB_TYPE;
    originalSqliteDbPath = process.env.SQLITE_DB_PATH;
    originalTursoUrl = process.env.TURSO_DATABASE_URL;
    originalTursoToken = process.env.TURSO_AUTH_TOKEN;
    
    // Clear environment variables
    delete process.env.DB_TYPE;
    delete process.env.SQLITE_DB_PATH;
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
  });

  afterEach(() => {
    // Restore original environment variables
    if (originalEnv !== undefined) {
      process.env.NODE_ENV = originalEnv;
    }
    if (originalDbType !== undefined) {
      process.env.DB_TYPE = originalDbType;
    } else {
      delete process.env.DB_TYPE;
    }
    if (originalSqliteDbPath !== undefined) {
      process.env.SQLITE_DB_PATH = originalSqliteDbPath;
    } else {
      delete process.env.SQLITE_DB_PATH;
    }
    if (originalTursoUrl !== undefined) {
      process.env.TURSO_DATABASE_URL = originalTursoUrl;
    } else {
      delete process.env.TURSO_DATABASE_URL;
    }
    if (originalTursoToken !== undefined) {
      process.env.TURSO_AUTH_TOKEN = originalTursoToken;
    } else {
      delete process.env.TURSO_AUTH_TOKEN;
    }
  });

  describe('validateDatabaseConfig', () => {
    it('should validate valid SQLite config', () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        dbPath: '/path/to/database.db'
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(true);
    });

    it('should validate valid Turso config', () => {
      const config: DatabaseConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io',
        authToken: 'test-token'
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(true);
    });

    it('should reject SQLite config without dbPath', () => {
      const config: DatabaseConfig = {
        type: 'sqlite'
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(false);
    });

    it('should reject SQLite config with empty dbPath', () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        dbPath: ''
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(false);
    });

    it('should reject Turso config without url', () => {
      const config: DatabaseConfig = {
        type: 'turso',
        authToken: 'test-token'
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(false);
    });

    it('should reject Turso config without authToken', () => {
      const config: DatabaseConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io'
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(false);
    });

    it('should reject Turso config with empty credentials', () => {
      const config: DatabaseConfig = {
        type: 'turso',
        url: '',
        authToken: ''
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(false);
    });

    it('should reject unsupported database type', () => {
      const config = {
        type: 'postgres' as any
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(false);
    });

    it('should handle null values', () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        dbPath: null as any
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(false);
    });

    it('should handle undefined values', () => {
      const config: DatabaseConfig = {
        type: 'turso',
        url: undefined,
        authToken: undefined
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(false);
    });

    it('should handle whitespace-only values', () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        dbPath: '   '
      };

      const result = validateDatabaseConfig(config);

      // The current implementation only checks for truthiness, not for non-empty strings
      // A string with whitespace is truthy, so it returns true
      expect(result).toBe(true);
    });

    it('should validate SQLite config with whitespace in path', () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        dbPath: '/path with spaces/database.db'
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(true);
    });

    it('should validate Turso config with complex URL', () => {
      const config: DatabaseConfig = {
        type: 'turso',
        url: 'libsql://my-db-name-123.turso.io',
        authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test'
      };

      const result = validateDatabaseConfig(config);

      expect(result).toBe(true);
    });
  });

  describe('getDatabaseStatus', () => {
    it('should return status for valid SQLite config', () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        dbPath: '/path/to/database.db'
      };

      const status = getDatabaseStatus(config);

      expect(status).toEqual({
        configured: true,
        dialect: 'sqlite',
        type: 'sqlite'
      });
    });

    it('should return status for valid Turso config', () => {
      const config: DatabaseConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io',
        authToken: 'test-token'
      };

      const status = getDatabaseStatus(config);

      expect(status).toEqual({
        configured: true,
        dialect: 'turso',
        type: 'turso'
      });
    });

    it('should return status for invalid SQLite config', () => {
      const config: DatabaseConfig = {
        type: 'sqlite'
        // Missing dbPath
      };

      const status = getDatabaseStatus(config);

      expect(status).toEqual({
        configured: false,
        dialect: 'sqlite',
        type: 'sqlite'
      });
    });

    it('should return status for invalid Turso config', () => {
      const config: DatabaseConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io'
        // Missing authToken
      };

      const status = getDatabaseStatus(config);

      expect(status).toEqual({
        configured: false,
        dialect: 'turso',
        type: 'turso'
      });
    });

    it('should return status for config with empty values', () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        dbPath: ''
      };

      const status = getDatabaseStatus(config);

      expect(status).toEqual({
        configured: false,
        dialect: 'sqlite',
        type: 'sqlite'
      });
    });
  });

  describe('Type validation', () => {
    it('should handle config with extra properties', () => {
      const config = {
        type: 'sqlite' as const,
        dbPath: '/path/to/db',
        extraProperty: 'should be ignored'
      };

      const result = validateDatabaseConfig(config);
      expect(result).toBe(true);

      const status = getDatabaseStatus(config);
      expect(status.configured).toBe(true);
    });

    it('should handle config with missing type', () => {
      const config = {
        dbPath: '/path/to/db'
      } as any;

      const result = validateDatabaseConfig(config);
      expect(result).toBe(false);
    });

    it('should handle null config', () => {
      const config = null as any;

      expect(() => validateDatabaseConfig(config)).toThrow();
    });

    it('should handle undefined config', () => {
      const config = undefined as any;

      expect(() => validateDatabaseConfig(config)).toThrow();
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle very long paths', () => {
      const longPath = '/very/long/path/'.repeat(50) + 'database.db';
      const config: DatabaseConfig = {
        type: 'sqlite',
        dbPath: longPath
      };

      const result = validateDatabaseConfig(config);
      expect(result).toBe(true);
    });

    it('should handle special characters in paths', () => {
      const config: DatabaseConfig = {
        type: 'sqlite',
        dbPath: '/path/with/special-chars_123/database.db'
      };

      const result = validateDatabaseConfig(config);
      expect(result).toBe(true);
    });

    it('should handle URLs with ports', () => {
      const config: DatabaseConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io:8080',
        authToken: 'test-token'
      };

      const result = validateDatabaseConfig(config);
      expect(result).toBe(true);
    });

    it('should handle very long auth tokens', () => {
      const longToken = 'a'.repeat(1000);
      const config: DatabaseConfig = {
        type: 'turso',
        url: 'libsql://test.turso.io',
        authToken: longToken
      };

      const result = validateDatabaseConfig(config);
      expect(result).toBe(true);
    });

    it('should handle case sensitivity in database type', () => {
      const config = {
        type: 'SQLite' as any,
        dbPath: '/path/to/db'
      };

      const result = validateDatabaseConfig(config);
      expect(result).toBe(false);
    });
  });
});
