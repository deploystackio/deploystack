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
  // Get the first available provider for dynamic testing
  const getFirstProvider = (): CloudProvider => {
    const providers = Object.values(CLOUD_PROVIDERS);
    if (providers.length === 0) {
      throw new Error('No cloud providers configured');
    }
    return providers[0];
  };

  const getFirstRequiredField = (provider: CloudProvider): CredentialField => {
    const requiredField = provider.fields.find(field => field.required);
    if (!requiredField) {
      throw new Error(`No required fields found for provider ${provider.id}`);
    }
    return requiredField;
  };

  describe('CLOUD_PROVIDERS constant', () => {
    it('should contain at least one provider', () => {
      const providerKeys = Object.keys(CLOUD_PROVIDERS);
      expect(providerKeys.length).toBeGreaterThan(0);
    });

    it('should have valid provider structures', () => {
      Object.values(CLOUD_PROVIDERS).forEach(provider => {
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
        
        expect(provider.id.length).toBeGreaterThan(0);
        expect(provider.name.length).toBeGreaterThan(0);
        expect(provider.description.length).toBeGreaterThan(0);
      });
    });

    it('should have valid field structures', () => {
      Object.values(CLOUD_PROVIDERS).forEach(provider => {
        provider.fields.forEach(field => {
          expect(field).toHaveProperty('key');
          expect(field).toHaveProperty('label');
          expect(field).toHaveProperty('type');
          expect(field).toHaveProperty('required');
          expect(field).toHaveProperty('secret');
          
          expect(typeof field.key).toBe('string');
          expect(typeof field.label).toBe('string');
          expect(['text', 'password', 'textarea']).toContain(field.type);
          expect(typeof field.required).toBe('boolean');
          expect(typeof field.secret).toBe('boolean');
          
          expect(field.key.length).toBeGreaterThan(0);
          expect(field.label.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('getCloudProvider', () => {
    it('should return provider when given valid ID', () => {
      const firstProvider = getFirstProvider();
      const provider = getCloudProvider(firstProvider.id);
      
      expect(provider).toBeDefined();
      expect(provider?.id).toBe(firstProvider.id);
      expect(provider?.name).toBe(firstProvider.name);
    });

    it('should return null for invalid provider ID', () => {
      const provider = getCloudProvider('invalid-provider-id-that-does-not-exist');
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
      const firstProvider = getFirstProvider();
      const provider = getCloudProvider(firstProvider.id.toUpperCase());
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
      it('should validate correct credentials', () => {
        const provider = getFirstProvider();
        
        // Create valid test data for all required fields
        const data: Record<string, string> = {};
        
        provider.fields.forEach(field => {
          if (field.required) {
            let validValue = 'test-value';
            
            // Handle specific validation patterns
            if (field.validation?.pattern) {
              if (field.validation.pattern === '^[a-z][a-z0-9-]{4,61}[a-z0-9]$') {
                // GCP project_id pattern
                validValue = 'test-project-123';
              } else if (field.validation.pattern.includes('service_account')) {
                // JSON pattern - create minimal valid JSON
                validValue = '{"type":"service_account","project_id":"test"}';
              }
            }
            
            // Handle minimum length requirements
            if (field.validation?.minLength && validValue.length < field.validation.minLength) {
              if (field.type === 'textarea') {
                // For textarea fields like JSON, create longer valid content
                validValue = '{"type":"service_account","project_id":"test-project","private_key":"-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\\n-----END PRIVATE KEY-----\\n","client_email":"test@test.iam.gserviceaccount.com"}';
              } else {
                validValue = 'a'.repeat(field.validation.minLength);
              }
            }
            
            data[field.key] = validValue;
          }
        });
        
        const result = validateCredentialData(provider.id, data);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
      });

      it('should reject missing required fields', () => {
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const result = validateCredentialData(provider.id, {});
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} is required`);
      });

      it('should reject empty required fields', () => {
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const data = {
          [requiredField.key]: ''
        };
        
        const result = validateCredentialData(provider.id, data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} is required`);
      });

      it('should reject whitespace-only required fields', () => {
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const data = {
          [requiredField.key]: '   '
        };
        
        const result = validateCredentialData(provider.id, data);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} is required`);
      });

      it('should validate minimum length requirement', () => {
        const provider = getFirstProvider();
        const fieldWithMinLength = provider.fields.find(field => field.validation?.minLength);
        
        if (fieldWithMinLength && fieldWithMinLength.validation?.minLength) {
          const shortValue = 'a'.repeat(fieldWithMinLength.validation.minLength - 1);
          const data = {
            [fieldWithMinLength.key]: shortValue
          };
          
          const result = validateCredentialData(provider.id, data);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toContain(`${fieldWithMinLength.label} must be at least ${fieldWithMinLength.validation.minLength} characters`);
        }
      });

      it('should validate pattern requirement', () => {
        const provider = getFirstProvider();
        const fieldWithPattern = provider.fields.find(field => field.validation?.pattern);
        
        if (fieldWithPattern && fieldWithPattern.validation?.pattern) {
          // Create valid test data for all required fields first
          const data: Record<string, string> = {};
          
          provider.fields.forEach(field => {
            if (field.required) {
              let validValue = 'test-value';
              
              // Handle specific validation patterns
              if (field.validation?.pattern) {
                if (field.validation.pattern === '^[a-z][a-z0-9-]{4,61}[a-z0-9]$') {
                  // GCP project_id pattern
                  validValue = 'test-project-123';
                } else if (field.validation.pattern.includes('service_account')) {
                  // JSON pattern - create minimal valid JSON
                  validValue = '{"type":"service_account","project_id":"test"}';
                }
              }
              
              // Handle minimum length requirements
              if (field.validation?.minLength && validValue.length < field.validation.minLength) {
                if (field.type === 'textarea') {
                  // For textarea fields like JSON, create longer valid content
                  validValue = '{"type":"service_account","project_id":"test-project","private_key":"-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\\n-----END PRIVATE KEY-----\\n","client_email":"test@test.iam.gserviceaccount.com"}';
                } else {
                  validValue = 'a'.repeat(field.validation.minLength);
                }
              }
              
              data[field.key] = validValue;
            }
          });
          
          // Now override the field with pattern to have an invalid value
          // Use a value that will definitely fail the pattern
          let invalidValue = 'INVALID-PATTERN-123';
          if (fieldWithPattern.validation.pattern === '^[a-z][a-z0-9-]{4,61}[a-z0-9]$') {
            // For GCP project_id pattern, use uppercase which is invalid
            invalidValue = 'INVALID-PROJECT-ID';
          }
          
          data[fieldWithPattern.key] = invalidValue;
          
          const result = validateCredentialData(provider.id, data);
          
          expect(result.valid).toBe(false);
          expect(result.errors).toContain(`${fieldWithPattern.label} format is invalid`);
        }
      });

      it('should handle null values', () => {
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const data = {
          [requiredField.key]: null
        };
        
        const result = validateCredentialData(provider.id, data as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} is required`);
      });

      it('should handle undefined values', () => {
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const data = {
          [requiredField.key]: undefined
        };
        
        const result = validateCredentialData(provider.id, data as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} is required`);
      });

      it('should ignore extra fields not defined in provider', () => {
        const provider = getFirstProvider();
        
        // Create valid test data for all required fields
        const data: Record<string, string> = {};
        
        provider.fields.forEach(field => {
          if (field.required) {
            let validValue = 'test-value';
            
            // Handle specific validation patterns
            if (field.validation?.pattern) {
              if (field.validation.pattern === '^[a-z][a-z0-9-]{4,61}[a-z0-9]$') {
                // GCP project_id pattern
                validValue = 'test-project-123';
              } else if (field.validation.pattern.includes('service_account')) {
                // JSON pattern - create minimal valid JSON
                validValue = '{"type":"service_account","project_id":"test"}';
              }
            }
            
            // Handle minimum length requirements
            if (field.validation?.minLength && validValue.length < field.validation.minLength) {
              if (field.type === 'textarea') {
                // For textarea fields like JSON, create longer valid content
                validValue = '{"type":"service_account","project_id":"test-project","private_key":"-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJTUt9Us8cKB\\n-----END PRIVATE KEY-----\\n","client_email":"test@test.iam.gserviceaccount.com"}';
              } else {
                validValue = 'a'.repeat(field.validation.minLength);
              }
            }
            
            data[field.key] = validValue;
          }
        });
        
        // Add extra field that should be ignored
        data.extra_field = 'should be ignored';
        
        const result = validateCredentialData(provider.id, data);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
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
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const result = validateCredentialData(provider.id, {});
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} is required`);
      });

      it('should handle null data', () => {
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const result = validateCredentialData(provider.id, null as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} is required`);
      });

      it('should handle undefined data', () => {
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const result = validateCredentialData(provider.id, undefined as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} is required`);
      });

      it('should handle data with numeric values', () => {
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const data = {
          [requiredField.key]: 123456789
        };
        
        const result = validateCredentialData(provider.id, data as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} must be a valid string`);
      });

      it('should handle data with boolean values', () => {
        const provider = getFirstProvider();
        const requiredField = getFirstRequiredField(provider);
        
        const data = {
          [requiredField.key]: true
        };
        
        const result = validateCredentialData(provider.id, data as any);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain(`${requiredField.label} must be a valid string`);
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
