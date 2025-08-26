/**
 * Configuration Encryption Utilities
 * 
 * Provides utilities for encrypting/decrypting individual configuration values
 * based on schema type definitions. Supports selective encryption where only
 * values marked as type: "secret" are encrypted.
 */

import { encrypt, decrypt } from './encryption';

export interface ConfigValue {
  value: string;
  encrypted: boolean;
}

export class ConfigEncryption {
  /**
   * Encrypts a single configuration value
   */
  static encryptValue(value: string): string {
    return encrypt(value);
  }

  /**
   * Decrypts a single configuration value
   */
  static decryptValue(encryptedValue: string): string {
    return decrypt(encryptedValue);
  }

  /**
   * Checks if a value appears to be encrypted (basic heuristic)
   * Encrypted values from our encryption utility contain colons separating IV:encrypted:tag
   */
  static isEncryptedValue(value: string): boolean {
    if (!value || typeof value !== 'string') {
      return false;
    }
    
    // Our encryption format: "iv:encryptedData:authTag" (hex strings separated by colons)
    const parts = value.split(':');
    return parts.length === 3 && parts.every(part => /^[a-f0-9]+$/i.test(part));
  }

  /**
   * Returns a masked value for display purposes
   */
  static maskValue(): string {
    return '*****';
  }

  /**
   * Encrypts configuration values based on schema type definitions
   * Only values with type: "secret" are encrypted
   */
  static encryptConfigValues(
    config: Record<string, string>,
    schema: Array<{ name: string; type: string; }>
  ): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(config)) {
      const schemaItem = schema.find(item => item.name === key);
      const shouldEncrypt = schemaItem?.type === 'secret';
      
      if (shouldEncrypt && value && !this.isEncryptedValue(value)) {
        result[key] = this.encryptValue(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Decrypts configuration values based on schema type definitions
   * Only values with type: "secret" are decrypted
   */
  static decryptConfigValues(
    config: Record<string, string>,
    schema: Array<{ name: string; type: string; }>,
    maskSecrets: boolean = false
  ): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(config)) {
      const schemaItem = schema.find(item => item.name === key);
      const isSecret = schemaItem?.type === 'secret';
      
      if (isSecret && value && this.isEncryptedValue(value)) {
        if (maskSecrets) {
          result[key] = this.maskValue();
        } else {
          try {
            result[key] = this.decryptValue(value);
          } catch {
            // If decryption fails, return masked value for security
            result[key] = this.maskValue();
          }
        }
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Masks secret values in configuration for API responses
   * Returns configuration with secret values replaced with "*****"
   */
  static maskSecretValues(
    config: Record<string, string>,
    schema: Array<{ name: string; type: string; }>
  ): Record<string, string> {
    const result: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(config)) {
      const schemaItem = schema.find(item => item.name === key);
      const isSecret = schemaItem?.type === 'secret';
      
      if (isSecret) {
        result[key] = this.maskValue();
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
}
