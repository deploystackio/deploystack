import { describe, it, expect } from 'vitest';
import {
  GlobalSettingSchema,
  CreateGlobalSettingSchema,
  UpdateGlobalSettingSchema,
  BulkGlobalSettingsSchema,
  SearchGlobalSettingsSchema,
  CategoryFilterSchema,
  validateSettingKey,
  validateSettingValue,
} from '../../../../src/routes/globalSettings/schemas';

describe('Global Settings Schemas', () => {
  describe('GlobalSettingSchema', () => {
    it('should validate a valid global setting', () => {
      const validSetting = {
        key: 'app.name',
        value: 'MyApp',
        type: 'string',
        description: 'Application name',
        is_encrypted: false,
        group_id: 'general',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = GlobalSettingSchema.safeParse(validSetting);
      expect(result.success).toBe(true);
    });

    it('should reject invalid key format', () => {
      const invalidSetting = {
        key: 'invalid key with spaces',
        value: 'test',
        type: 'string',
        is_encrypted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = GlobalSettingSchema.safeParse(invalidSetting);
      expect(result.success).toBe(false);
    });

    it('should reject empty key', () => {
      const invalidSetting = {
        key: '',
        value: 'test',
        type: 'string',
        is_encrypted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = GlobalSettingSchema.safeParse(invalidSetting);
      expect(result.success).toBe(false);
    });

    it('should reject invalid type', () => {
      const invalidSetting = {
        key: 'app.name',
        value: 'test',
        type: 'invalid',
        is_encrypted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = GlobalSettingSchema.safeParse(invalidSetting);
      expect(result.success).toBe(false);
    });

    it('should allow optional fields to be undefined', () => {
      const minimalSetting = {
        key: 'app.name',
        value: 'test',
        type: 'string',
        is_encrypted: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const result = GlobalSettingSchema.safeParse(minimalSetting);
      expect(result.success).toBe(true);
    });
  });

  describe('CreateGlobalSettingSchema', () => {
    it('should validate a valid create request with string value', () => {
      const validCreate = {
        key: 'app.name',
        value: 'MyApp',
        type: 'string',
        description: 'Application name',
        encrypted: false,
        group_id: 'general',
      };

      const result = CreateGlobalSettingSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should validate a valid create request with number value', () => {
      const validCreate = {
        key: 'app.port',
        value: 3000,
        type: 'number',
        description: 'Application port',
      };

      const result = CreateGlobalSettingSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should validate a valid create request with boolean value', () => {
      const validCreate = {
        key: 'app.debug',
        value: true,
        type: 'boolean',
        description: 'Debug mode',
      };

      const result = CreateGlobalSettingSchema.safeParse(validCreate);
      expect(result.success).toBe(true);
    });

    it('should reject mismatched value and type (string value, number type)', () => {
      const invalidCreate = {
        key: 'app.port',
        value: 'not-a-number',
        type: 'number',
      };

      const result = CreateGlobalSettingSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Value must match the specified type');
      }
    });

    it('should reject mismatched value and type (number value, string type)', () => {
      const invalidCreate = {
        key: 'app.name',
        value: 123,
        type: 'string',
      };

      const result = CreateGlobalSettingSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Value must match the specified type');
      }
    });

    it('should reject mismatched value and type (string value, boolean type)', () => {
      const invalidCreate = {
        key: 'app.debug',
        value: 'true',
        type: 'boolean',
      };

      const result = CreateGlobalSettingSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Value must match the specified type');
      }
    });

    it('should default encrypted to false when not provided', () => {
      const createData = {
        key: 'app.name',
        value: 'MyApp',
        type: 'string',
      };

      const result = CreateGlobalSettingSchema.safeParse(createData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.encrypted).toBe(false);
      }
    });

    it('should reject invalid key format', () => {
      const invalidCreate = {
        key: 'invalid key!',
        value: 'test',
        type: 'string',
      };

      const result = CreateGlobalSettingSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });

    it('should reject key that is too long', () => {
      const invalidCreate = {
        key: 'a'.repeat(256),
        value: 'test',
        type: 'string',
      };

      const result = CreateGlobalSettingSchema.safeParse(invalidCreate);
      expect(result.success).toBe(false);
    });
  });

  describe('UpdateGlobalSettingSchema', () => {
    it('should validate a valid update request', () => {
      const validUpdate = {
        value: 'Updated value',
        description: 'Updated description',
        encrypted: true,
        group_id: 'new-group',
      };

      const result = UpdateGlobalSettingSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate partial update with only value', () => {
      const validUpdate = {
        value: 'Updated value',
      };

      const result = UpdateGlobalSettingSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate partial update with only description', () => {
      const validUpdate = {
        description: 'Updated description',
      };

      const result = UpdateGlobalSettingSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should reject empty update object', () => {
      const invalidUpdate = {};

      const result = UpdateGlobalSettingSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('At least one field must be provided for update');
      }
    });

    it('should reject empty value string', () => {
      const invalidUpdate = {
        value: '',
      };

      const result = UpdateGlobalSettingSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });

  describe('BulkGlobalSettingsSchema', () => {
    it('should validate a valid bulk request', () => {
      const validBulk = {
        settings: [
          {
            key: 'bulk.setting1',
            value: 'value1',
            type: 'string',
          },
          {
            key: 'bulk.setting2',
            value: 42,
            type: 'number',
          },
        ],
      };

      const result = BulkGlobalSettingsSchema.safeParse(validBulk);
      expect(result.success).toBe(true);
    });

    it('should reject empty settings array', () => {
      const invalidBulk = {
        settings: [],
      };

      const result = BulkGlobalSettingsSchema.safeParse(invalidBulk);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('At least one setting is required');
      }
    });

    it('should reject invalid setting in array', () => {
      const invalidBulk = {
        settings: [
          {
            key: 'valid.setting',
            value: 'value',
            type: 'string',
          },
          {
            key: 'invalid key!',
            value: 'value',
            type: 'string',
          },
        ],
      };

      const result = BulkGlobalSettingsSchema.safeParse(invalidBulk);
      expect(result.success).toBe(false);
    });
  });

  describe('SearchGlobalSettingsSchema', () => {
    it('should validate a valid search request', () => {
      const validSearch = {
        pattern: 'app.*',
      };

      const result = SearchGlobalSettingsSchema.safeParse(validSearch);
      expect(result.success).toBe(true);
    });

    it('should reject empty pattern', () => {
      const invalidSearch = {
        pattern: '',
      };

      const result = SearchGlobalSettingsSchema.safeParse(invalidSearch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Search pattern is required');
      }
    });

    it('should reject missing pattern', () => {
      const invalidSearch = {};

      const result = SearchGlobalSettingsSchema.safeParse(invalidSearch);
      expect(result.success).toBe(false);
    });
  });

  describe('CategoryFilterSchema', () => {
    it('should validate a valid category filter', () => {
      const validFilter = {
        category: 'general',
      };

      const result = CategoryFilterSchema.safeParse(validFilter);
      expect(result.success).toBe(true);
    });

    it('should reject empty category', () => {
      const invalidFilter = {
        category: '',
      };

      const result = CategoryFilterSchema.safeParse(invalidFilter);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Category is required');
      }
    });
  });

  describe('validateSettingKey', () => {
    it('should return true for valid keys', () => {
      expect(validateSettingKey('app.name')).toBe(true);
      expect(validateSettingKey('app_name')).toBe(true);
      expect(validateSettingKey('app-name')).toBe(true);
      expect(validateSettingKey('app.sub.setting')).toBe(true);
      expect(validateSettingKey('APP123')).toBe(true);
      expect(validateSettingKey('a')).toBe(true);
    });

    it('should return false for invalid keys', () => {
      expect(validateSettingKey('')).toBe(false);
      expect(validateSettingKey('app name')).toBe(false);
      expect(validateSettingKey('app!name')).toBe(false);
      expect(validateSettingKey('app@name')).toBe(false);
      expect(validateSettingKey('app#name')).toBe(false);
      expect(validateSettingKey('app$name')).toBe(false);
      expect(validateSettingKey('app%name')).toBe(false);
      expect(validateSettingKey('a'.repeat(256))).toBe(false);
    });
  });

  describe('validateSettingValue', () => {
    it('should return true for valid string values', () => {
      expect(validateSettingValue('test', 'string')).toBe(true);
      expect(validateSettingValue('hello world', 'string')).toBe(true);
      expect(validateSettingValue('123', 'string')).toBe(true);
    });

    it('should return false for invalid string values', () => {
      expect(validateSettingValue('', 'string')).toBe(false);
      expect(validateSettingValue(123, 'string')).toBe(false);
      expect(validateSettingValue(true, 'string')).toBe(false);
    });

    it('should return true for valid number values', () => {
      expect(validateSettingValue(123, 'number')).toBe(true);
      expect(validateSettingValue(0, 'number')).toBe(true);
      expect(validateSettingValue(-123, 'number')).toBe(true);
      expect(validateSettingValue(123.45, 'number')).toBe(true);
    });

    it('should return false for invalid number values', () => {
      expect(validateSettingValue('123', 'number')).toBe(false);
      expect(validateSettingValue(true, 'number')).toBe(false);
      expect(validateSettingValue(NaN, 'number')).toBe(false);
    });

    it('should return true for valid boolean values', () => {
      expect(validateSettingValue(true, 'boolean')).toBe(true);
      expect(validateSettingValue(false, 'boolean')).toBe(true);
    });

    it('should return false for invalid boolean values', () => {
      expect(validateSettingValue('true', 'boolean')).toBe(false);
      expect(validateSettingValue('false', 'boolean')).toBe(false);
      expect(validateSettingValue(1, 'boolean')).toBe(false);
      expect(validateSettingValue(0, 'boolean')).toBe(false);
    });

    it('should return false for invalid type', () => {
      expect(validateSettingValue('test', 'invalid' as any)).toBe(false);
    });
  });
});
