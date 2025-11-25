import { describe, it, expect } from 'vitest';
import {
  DatabaseType,
  DbSetupRequestBodySchema,
  DbStatusResponseSchema,
  type DbSetupRequestBody,
  type DbStatusResponse,
} from '../../../../src/routes/db/schemas';

describe('Database Schemas', () => {
  describe('DatabaseType Enum', () => {
    it('should have correct PostgreSQL value', () => {
      expect(DatabaseType.PostgreSQL).toBe('postgresql');
    });

    it('should contain only PostgreSQL type', () => {
      const values = Object.values(DatabaseType);
      expect(values).toEqual(['postgresql']);
      expect(values).toHaveLength(1);
    });
  });

  describe('DbSetupRequestBodySchema', () => {
    it('should validate valid PostgreSQL setup request', () => {
      const validRequest = {
        type: DatabaseType.PostgreSQL,
      };

      const result = DbSetupRequestBodySchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validRequest);
      }
    });

    it('should reject invalid database type', () => {
      const invalidRequest = {
        type: 'mysql',
      };

      const result = DbSetupRequestBodySchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_value');
        expect(result.error.issues[0].path).toEqual(['type']);
      }
    });

    it('should reject missing type', () => {
      const invalidRequest = {};

      const result = DbSetupRequestBodySchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_value');
        expect(result.error.issues[0].path).toEqual(['type']);
      }
    });

    it('should ignore extra properties', () => {
      const requestWithExtra = {
        type: DatabaseType.PostgreSQL,
        extraProperty: 'should be ignored',
        connectionString: 'should also be ignored',
      };

      const result = DbSetupRequestBodySchema.safeParse(requestWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ type: DatabaseType.PostgreSQL });
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
        expect(result.error.issues[0].code).toBe('invalid_value');
        expect(result.error.issues[0].path).toEqual(['type']);
      }
    });
  });

  describe('DbStatusResponseSchema', () => {
    it('should validate valid status response', () => {
      const validResponse = {
        configured: true,
        initialized: true,
        dialect: DatabaseType.PostgreSQL,
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
        dialect: DatabaseType.PostgreSQL,
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
        dialect: DatabaseType.PostgreSQL,
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
        dialect: 'mysql',
      };

      const result = DbStatusResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('invalid_value');
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
    it('should infer correct DbSetupRequestBody type', () => {
      const request: DbSetupRequestBody = {
        type: DatabaseType.PostgreSQL,
      };

      expect(request.type).toBe('postgresql');
    });

    it('should infer correct DbStatusResponse type', () => {
      const response: DbStatusResponse = {
        configured: true,
        initialized: true,
        dialect: DatabaseType.PostgreSQL,
      };

      expect(typeof response.configured).toBe('boolean');
      expect(typeof response.initialized).toBe('boolean');
      expect(response.dialect).toBe('postgresql');
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
      const result = DbSetupRequestBodySchema.safeParse('postgresql');
      expect(result.success).toBe(false);
    });
  });
});
