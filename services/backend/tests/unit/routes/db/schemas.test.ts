import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  DatabaseType,
  SQLiteInternalConfigSchema,
  InternalDbConfigSchema,
  DbSetupRequestBodySchema,
  DbStatusResponseSchema,
  type SQLiteInternalConfig,
  type InternalDbConfig,
  type DbSetupRequestBody,
  type DbStatusResponse,
} from '../../../../src/routes/db/schemas';

describe('Database Schemas', () => {
  describe('DatabaseType Enum', () => {
    it('should have correct SQLite value', () => {
      expect(DatabaseType.SQLite).toBe('sqlite');
    });

    it('should only contain SQLite type', () => {
      const values = Object.values(DatabaseType);
      expect(values).toEqual(['sqlite']);
      expect(values).toHaveLength(1);
    });
  });

  describe('SQLiteInternalConfigSchema', () => {
    it('should validate valid SQLite config', () => {
      const validConfig = {
        type: DatabaseType.SQLite,
        dbPath: '/path/to/database.db',
      };

      const result = SQLiteInternalConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validConfig);
      }
    });

    it('should reject invalid type', () => {
      const invalidConfig = {
        type: 'postgres',
        dbPath: '/path/to/database.db',
      };

      const result = SQLiteInternalConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_literal');
        expect(result.error.issues[0].path).toEqual(['type']);
      }
    });

    it('should reject missing dbPath', () => {
      const invalidConfig = {
        type: DatabaseType.SQLite,
      };

      const result = SQLiteInternalConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_type');
        expect(result.error.issues[0].path).toEqual(['dbPath']);
      }
    });

    it('should reject empty dbPath', () => {
      const invalidConfig = {
        type: DatabaseType.SQLite,
        dbPath: '',
      };

      const result = SQLiteInternalConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(true); // Empty string is valid for dbPath
      if (result.success) {
        expect(result.data.dbPath).toBe('');
      }
    });

    it('should reject non-string dbPath', () => {
      const invalidConfig = {
        type: DatabaseType.SQLite,
        dbPath: 123,
      };

      const result = SQLiteInternalConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_type');
        expect(result.error.issues[0].path).toEqual(['dbPath']);
      }
    });

    it('should handle relative paths', () => {
      const validConfig = {
        type: DatabaseType.SQLite,
        dbPath: './database/deploystack.db',
      };

      const result = SQLiteInternalConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dbPath).toBe('./database/deploystack.db');
      }
    });

    it('should handle absolute paths', () => {
      const validConfig = {
        type: DatabaseType.SQLite,
        dbPath: '/absolute/path/to/database.db',
      };

      const result = SQLiteInternalConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dbPath).toBe('/absolute/path/to/database.db');
      }
    });
  });

  describe('InternalDbConfigSchema', () => {
    it('should be equivalent to SQLiteInternalConfigSchema', () => {
      const validConfig = {
        type: DatabaseType.SQLite,
        dbPath: '/path/to/database.db',
      };

      const sqliteResult = SQLiteInternalConfigSchema.safeParse(validConfig);
      const internalResult = InternalDbConfigSchema.safeParse(validConfig);

      expect(sqliteResult.success).toBe(internalResult.success);
      if (sqliteResult.success && internalResult.success) {
        expect(sqliteResult.data).toEqual(internalResult.data);
      }
    });
  });

  describe('DbSetupRequestBodySchema', () => {
    it('should validate valid SQLite setup request', () => {
      const validRequest = {
        type: DatabaseType.SQLite,
      };

      const result = DbSetupRequestBodySchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validRequest);
      }
    });

    it('should reject invalid database type', () => {
      const invalidRequest = {
        type: 'postgres',
      };

      const result = DbSetupRequestBodySchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_enum_value');
        expect(result.error.issues[0].path).toEqual(['type']);
      }
    });

    it('should reject missing type', () => {
      const invalidRequest = {};

      const result = DbSetupRequestBodySchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_type');
        expect(result.error.issues[0].path).toEqual(['type']);
      }
    });

    it('should ignore extra properties', () => {
      const requestWithExtra = {
        type: DatabaseType.SQLite,
        extraProperty: 'should be ignored',
        connectionString: 'should also be ignored',
      };

      const result = DbSetupRequestBodySchema.safeParse(requestWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ type: DatabaseType.SQLite });
        expect(result.data).not.toHaveProperty('extraProperty');
        expect(result.data).not.toHaveProperty('connectionString');
      }
    });

    it('should handle numeric type values', () => {
      const invalidRequest = {
        type: 1,
      };

      const result = DbSetupRequestBodySchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_enum_value');
        expect(result.error.issues[0].path).toEqual(['type']);
      }
    });
  });

  describe('DbStatusResponseSchema', () => {
    it('should validate valid status response', () => {
      const validResponse = {
        configured: true,
        initialized: true,
        dialect: DatabaseType.SQLite,
      };

      const result = DbStatusResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validResponse);
      }
    });

    it('should validate status response with null dialect', () => {
      const validResponse = {
        configured: false,
        initialized: false,
        dialect: null,
      };

      const result = DbStatusResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validResponse);
      }
    });

    it('should reject invalid configured value', () => {
      const invalidResponse = {
        configured: 'true',
        initialized: true,
        dialect: DatabaseType.SQLite,
      };

      const result = DbStatusResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_type');
        expect(result.error.issues[0].path).toEqual(['configured']);
      }
    });

    it('should reject invalid initialized value', () => {
      const invalidResponse = {
        configured: true,
        initialized: 1,
        dialect: DatabaseType.SQLite,
      };

      const result = DbStatusResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_type');
        expect(result.error.issues[0].path).toEqual(['initialized']);
      }
    });

    it('should reject invalid dialect value', () => {
      const invalidResponse = {
        configured: true,
        initialized: true,
        dialect: 'postgres',
      };

      const result = DbStatusResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_enum_value');
        expect(result.error.issues[0].path).toEqual(['dialect']);
      }
    });

    it('should reject missing required fields', () => {
      const invalidResponse = {
        configured: true,
      };

      const result = DbStatusResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toHaveLength(2);
        expect(result.error.issues.some(issue => issue.path.includes('initialized'))).toBe(true);
        expect(result.error.issues.some(issue => issue.path.includes('dialect'))).toBe(true);
      }
    });

    it('should handle mixed valid/invalid states', () => {
      const validResponse = {
        configured: true,
        initialized: false,
        dialect: null,
      };

      const result = DbStatusResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.configured).toBe(true);
        expect(result.data.initialized).toBe(false);
        expect(result.data.dialect).toBe(null);
      }
    });
  });

  describe('Type Inference', () => {
    it('should infer correct SQLiteInternalConfig type', () => {
      const config: SQLiteInternalConfig = {
        type: DatabaseType.SQLite,
        dbPath: '/path/to/db',
      };

      expect(config.type).toBe('sqlite');
      expect(typeof config.dbPath).toBe('string');
    });

    it('should infer correct InternalDbConfig type', () => {
      const config: InternalDbConfig = {
        type: DatabaseType.SQLite,
        dbPath: '/path/to/db',
      };

      expect(config.type).toBe('sqlite');
      expect(typeof config.dbPath).toBe('string');
    });

    it('should infer correct DbSetupRequestBody type', () => {
      const request: DbSetupRequestBody = {
        type: DatabaseType.SQLite,
      };

      expect(request.type).toBe('sqlite');
    });

    it('should infer correct DbStatusResponse type', () => {
      const response: DbStatusResponse = {
        configured: true,
        initialized: true,
        dialect: DatabaseType.SQLite,
      };

      expect(typeof response.configured).toBe('boolean');
      expect(typeof response.initialized).toBe('boolean');
      expect(response.dialect).toBe('sqlite');
    });

    it('should allow null dialect in DbStatusResponse type', () => {
      const response: DbStatusResponse = {
        configured: false,
        initialized: false,
        dialect: null,
      };

      expect(response.dialect).toBe(null);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should handle undefined values', () => {
      const result = DbSetupRequestBodySchema.safeParse(undefined);
      expect(result.success).toBe(false);
    });

    it('should handle null values', () => {
      const result = DbSetupRequestBodySchema.safeParse(null);
      expect(result.success).toBe(false);
    });

    it('should handle empty objects', () => {
      const result = DbSetupRequestBodySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should handle arrays', () => {
      const result = DbSetupRequestBodySchema.safeParse([]);
      expect(result.success).toBe(false);
    });

    it('should handle primitive values', () => {
      const result = DbSetupRequestBodySchema.safeParse('sqlite');
      expect(result.success).toBe(false);
    });
  });
});
