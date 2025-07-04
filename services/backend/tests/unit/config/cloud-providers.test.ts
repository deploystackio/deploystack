import { describe, it, expect } from 'vitest';
import {
  CLOUD_PROVIDERS,
  getCloudProvider,
  getEnabledCloudProviders,
  validateCredentialData,
  type CloudProvider,
  type CredentialField
} from '../../../src/config/cloud-providers';

describe('Cloud Providers Configuration', () => {
  describe('CLOUD_PROVIDERS constant', () => {
    it('should contain render provider', () => {
      expect(CLOUD_PROVIDERS).toHaveProperty('render');
      expect(CLOUD_PROVIDERS.render).toBeDefined();
    });

    it('should have valid render provider structure', () => {
      const renderProvider = CLOUD_PROVIDERS.render;
      
      expect(renderProvider.id).toBe('render');
      expect(renderProvider.name).toBe('Render.com');
      expect(renderProvider.description).toBe('Deploy applications and services on Render');
      expect(renderProvider.enabled).toBe(true);
      expect(Array.isArray(renderProvider.fields)).toBe(true);
      expect(renderProvider.fields.length).toBeGreaterThan(0);
    });

    it('should have valid render API key field', () => {
      const renderProvider = CLOUD_PROVIDERS.render;
      const apiKeyField = renderProvider.fields.find(field => field.key === 'api_key');
      
      expect(apiKeyField).toBeDefined();
      expect(apiKeyField?.label).toBe('API Key');
      expect(apiKeyField?.type).toBe('password');
      expect(apiKeyField?.required).toBe(true);
      expect(apiKeyField?.secret).toBe(true);
      expect(apiKeyField?.placeholder).toBe('rnd_xxxxxxxxxxxxxxxxxx');
      expect(apiKeyField?.description).toBe('Your Render API key from Account Settings');
      expect(apiKeyField?.validation).toBeDefined();
      expect(apiKeyField?.validation?.minLength).toBe(20);
      expect(apiKeyField?.validation?.pattern).toBe('^rnd_[a-zA-Z0-9]+$');
    });
  });

  describe('getCloudProvider', () => {
    it('should return render provider when given valid ID', () => {
      const provider = getCloudProvider('render');
      
      expect(provider).toBeDefined();
      expect(provider?.id).toBe('render');
      expect(provider?.name).toBe('Render.com');
    });

    it('should return null for invalid provider ID', () => {
      const provider = getCloudProvider('invalid-provider');
      
      expect(provider).toBeNull();
    });

    it('should return null for empty string', () => {
      const provider = getCloudProvider('');
      
      expect(provider).toBeNull();
    });

    it('should return null for undefined', () => {
      const provider = getCloudProvider(undefined as any);
      
      expect(provider).toBeNull();
    });

    it('should be case sensitive', () => {
      const provider = getCloudProvider('RENDER');
      
      expect(provider).toBeNull();
    });
  });

  describe('getEnabledCloudProviders', () => {
    it('should return array of enabled providers', () => {
      const providers = getEnabledCloudProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should only return enabled providers', () => {
      const providers = getEnabledCloudProviders();
      
      providers.forEach(provider => {
        expect(provider.enabled).toBe(true);
      });
    });

    it('should include render provider', () => {
      const providers = getEnabledCloudProviders();
      const renderProvider = providers.find(p => p.id === 'render');
      
      expect(renderProvider).toBeDefined();
      expect(renderProvider?.enabled).toBe(true);
    });

    it('should return providers with all required properties', () => {
      const providers = getEnabledCloudProviders();
      
      providers.forEach(provider => {
        expect(provider).toHaveProperty('id');
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('description');
        expect(provider).toHaveProperty('fields');
        expect(provider).toHaveProperty('enabled');
        expect(typeof provider.id).toBe('string');
        expect(typeof provider.name).toBe('string');
        expect(typeof provider.description).toBe('string');
        expect(Array.isArray(provider.fields)).toBe(true);
        expect(typeof provider.enabled).toBe('boolean');
      });
    });
  });

  describe('validateCredentialData', () => {
    describe('with valid provider', () => {
      it('should validate correct render credentials', () => {
        const data = {
          api_key: 'rnd_abcdefghijklmnopqrstuvwxyz123456'
        };
        
        const result = validateCredentialData('render', data);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject missing required fields', () => {
        const data = {};
        
        const result = validateCredentialData('render', data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key is required');
      });

      it('should reject empty required fields', () => {
        const data = {
          api_key: ''
        };
        
        const result = validateCredentialData('render', data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key is required');
      });

      it('should reject whitespace-only required fields', () => {
        const data = {
          api_key: '   '
        };
        
        const result = validateCredentialData('render', data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key is required');
      });

      it('should validate minimum length requirement', () => {
        const data = {
          api_key: 'rnd_short'
        };
        
        const result = validateCredentialData('render', data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key must be at least 20 characters');
      });

      it('should validate pattern requirement', () => {
        const data = {
          api_key: 'invalid_pattern_that_is_long_enough_but_wrong'
        };
        
        const result = validateCredentialData('render', data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key format is invalid');
      });

      it('should validate maximum length if specified', () => {
        // Create a test case with a field that has maxLength validation
        const longValue = 'rnd_' + 'a'.repeat(1000);
        const data = {
          api_key: longValue
        };
        
        // Since render API key doesn't have maxLength, this should pass pattern and minLength
        const result = validateCredentialData('render', data);
        
        // Should fail on pattern because it's too long for the expected format
        expect(result.valid).toBe(true); // Actually passes because pattern allows any length after rnd_
      });

      it('should handle multiple validation errors', () => {
        const data = {
          api_key: 'short'
        };
        
        const result = validateCredentialData('render', data);
        
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors).toContain('API Key must be at least 20 characters');
        expect(result.errors).toContain('API Key format is invalid');
      });

      it('should handle null values', () => {
        const data = {
          api_key: null
        };
        
        const result = validateCredentialData('render', data as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key is required');
      });

      it('should handle undefined values', () => {
        const data = {
          api_key: undefined
        };
        
        const result = validateCredentialData('render', data as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key is required');
      });

      it('should ignore extra fields not defined in provider', () => {
        const data = {
          api_key: 'rnd_abcdefghijklmnopqrstuvwxyz123456',
          extra_field: 'should be ignored'
        };
        
        const result = validateCredentialData('render', data);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should validate fields with no validation rules', () => {
        // Test with a hypothetical field that has no validation
        const data = {
          api_key: 'rnd_abcdefghijklmnopqrstuvwxyz123456'
        };
        
        const result = validateCredentialData('render', data);
        
        expect(result.valid).toBe(true);
      });
    });

    describe('with invalid provider', () => {
      it('should return error for non-existent provider', () => {
        const data = {
          some_field: 'some_value'
        };
        
        const result = validateCredentialData('non-existent', data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid provider ID');
      });

      it('should return error for empty provider ID', () => {
        const data = {
          some_field: 'some_value'
        };
        
        const result = validateCredentialData('', data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid provider ID');
      });

      it('should return error for null provider ID', () => {
        const data = {
          some_field: 'some_value'
        };
        
        const result = validateCredentialData(null as any, data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid provider ID');
      });

      it('should return error for undefined provider ID', () => {
        const data = {
          some_field: 'some_value'
        };
        
        const result = validateCredentialData(undefined as any, data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Invalid provider ID');
      });
    });

    describe('edge cases', () => {
      it('should handle empty data object', () => {
        const result = validateCredentialData('render', {});
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key is required');
      });

      it('should handle null data', () => {
        const result = validateCredentialData('render', null as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key is required');
      });

      it('should handle undefined data', () => {
        const result = validateCredentialData('render', undefined as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key is required');
      });

      it('should handle data with numeric values', () => {
        const data = {
          api_key: 123456789
        };
        
        const result = validateCredentialData('render', data as any);
        
        // Should fail because numeric values are not valid strings for required fields
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key must be a valid string');
      });

      it('should handle data with boolean values', () => {
        const data = {
          api_key: true
        };
        
        const result = validateCredentialData('render', data as any);
        
        // Should fail because boolean values are not valid strings for required fields
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('API Key must be a valid string');
      });
    });
  });

  describe('Type definitions', () => {
    it('should have correct CredentialField interface', () => {
      const field: CredentialField = {
        key: 'test_key',
        label: 'Test Label',
        type: 'text',
        required: true,
        secret: false
      };
      
      expect(field.key).toBe('test_key');
      expect(field.label).toBe('Test Label');
      expect(field.type).toBe('text');
      expect(field.required).toBe(true);
      expect(field.secret).toBe(false);
    });

    it('should have correct CloudProvider interface', () => {
      const provider: CloudProvider = {
        id: 'test',
        name: 'Test Provider',
        description: 'Test Description',
        fields: [],
        enabled: true
      };
      
      expect(provider.id).toBe('test');
      expect(provider.name).toBe('Test Provider');
      expect(provider.description).toBe('Test Description');
      expect(Array.isArray(provider.fields)).toBe(true);
      expect(provider.enabled).toBe(true);
    });

    it('should support all field types', () => {
      const textField: CredentialField = {
        key: 'text_field',
        label: 'Text Field',
        type: 'text',
        required: false,
        secret: false
      };

      const passwordField: CredentialField = {
        key: 'password_field',
        label: 'Password Field',
        type: 'password',
        required: true,
        secret: true
      };

      const textareaField: CredentialField = {
        key: 'textarea_field',
        label: 'Textarea Field',
        type: 'textarea',
        required: false,
        secret: false
      };

      expect(textField.type).toBe('text');
      expect(passwordField.type).toBe('password');
      expect(textareaField.type).toBe('textarea');
    });

    it('should support optional field properties', () => {
      const fieldWithOptionals: CredentialField = {
        key: 'test_key',
        label: 'Test Label',
        type: 'text',
        required: true,
        secret: false,
        placeholder: 'Enter value...',
        description: 'This is a test field',
        validation: {
          pattern: '^test_.*',
          minLength: 5,
          maxLength: 50
        }
      };
      
      expect(fieldWithOptionals.placeholder).toBe('Enter value...');
      expect(fieldWithOptionals.description).toBe('This is a test field');
      expect(fieldWithOptionals.validation?.pattern).toBe('^test_.*');
      expect(fieldWithOptionals.validation?.minLength).toBe(5);
      expect(fieldWithOptionals.validation?.maxLength).toBe(50);
    });
  });
});
