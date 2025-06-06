import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, isEncrypted, validateEncryption } from '../../../src/utils/encryption';
import crypto from 'node:crypto';

describe('encryption.ts', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Store original environment variables
    originalEnv = { ...process.env };
    
    // Spy on console.log to capture debug output
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Set a consistent test environment
    process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-super-secret-key-for-jest';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
    
    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  describe('encrypt', () => {
    it('should encrypt a simple string successfully', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'Hello, World!';
      
      const encrypted = encrypt(plaintext);
      
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(plaintext);
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should produce different outputs for the same input (due to random IV)', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'Same input text';
      
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      
      expect(encrypted1).not.toBe(encrypted2);
      expect(encrypted1.split(':')[0]).not.toBe(encrypted2.split(':')[0]); // Different IVs
    });

    it('should handle empty string', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = '';
      
      const encrypted = encrypt(plaintext);
      
      expect(typeof encrypted).toBe('string');
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should handle long strings', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'A'.repeat(10000);
      
      const encrypted = encrypt(plaintext);
      
      expect(typeof encrypted).toBe('string');
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should handle special characters and unicode', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = '🚀 Special chars: !@#$%^&*()_+ 中文 العربية';
      
      const encrypted = encrypt(plaintext);
      
      expect(typeof encrypted).toBe('string');
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should use fallback secret when environment variable is not set', () => {
      delete process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      const plaintext = 'Test with fallback';
      
      const encrypted = encrypt(plaintext);
      
      expect(typeof encrypted).toBe('string');
      expect(encrypted.split(':')).toHaveLength(3);
    });

    it('should produce valid hex-encoded components', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'Test hex encoding';
      
      const encrypted = encrypt(plaintext);
      const [iv, authTag, encryptedData] = encrypted.split(':');
      
      // Check that all parts are valid hex strings
      expect(iv).toMatch(/^[0-9a-f]+$/i);
      expect(authTag).toMatch(/^[0-9a-f]+$/i);
      expect(encryptedData).toMatch(/^[0-9a-f]*$/i); // Can be empty for empty input
      
      // Check expected lengths
      expect(iv).toHaveLength(32); // 16 bytes * 2 hex chars
      expect(authTag).toHaveLength(32); // 16 bytes * 2 hex chars
    });

    it('should throw error when crypto operations fail', () => {
      // Mock crypto.createCipheriv to throw an error
      const originalCreateCipheriv = crypto.createCipheriv;
      vi.spyOn(crypto, 'createCipheriv').mockImplementation(() => {
        throw new Error('Crypto operation failed');
      });

      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      
      expect(() => encrypt('test')).toThrow('Encryption failed: Crypto operation failed');
      
      // Restore original function
      crypto.createCipheriv = originalCreateCipheriv;
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data back to original text', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'Hello, World!';
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string encryption/decryption', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = '';
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'Long string: ' + 'A'.repeat(5000);
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters and unicode', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = '🚀 Special chars: !@#$%^&*()_+ 中文 العربية';
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid format (wrong number of parts)', () => {
      expect(() => decrypt('invalid')).toThrow('Invalid encrypted data format');
      expect(() => decrypt('part1:part2')).toThrow('Invalid encrypted data format');
      expect(() => decrypt('part1:part2:part3:part4')).toThrow('Invalid encrypted data format');
    });

    it('should throw error for invalid hex data', () => {
      const invalidHex = 'invalid_hex:32_char_hex_string_here_123456:encrypted_data';
      
      expect(() => decrypt(invalidHex)).toThrow('Decryption failed');
    });

    it('should throw error when using wrong encryption secret', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'original-secret';
      const plaintext = 'Secret message';
      const encrypted = encrypt(plaintext);
      
      // Change the secret
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'different-secret';
      
      expect(() => decrypt(encrypted)).toThrow('Decryption failed');
    });

    it('should throw error for tampered encrypted data', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'Original message';
      const encrypted = encrypt(plaintext);
      
      // Tamper with the encrypted data
      const [iv, authTag, encryptedData] = encrypted.split(':');
      const tamperedData = iv + ':' + authTag + ':' + encryptedData.slice(0, -2) + '00';
      
      expect(() => decrypt(tamperedData)).toThrow('Decryption failed');
    });

    it('should throw error for tampered auth tag', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'Original message';
      const encrypted = encrypt(plaintext);
      
      // Tamper with the auth tag
      const [iv, authTag, encryptedData] = encrypted.split(':');
      const tamperedAuthTag = authTag.slice(0, -2) + '00';
      const tamperedData = iv + ':' + tamperedAuthTag + ':' + encryptedData;
      
      expect(() => decrypt(tamperedData)).toThrow('Decryption failed');
    });

    it('should throw error for tampered IV', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'Original message';
      const encrypted = encrypt(plaintext);
      
      // Tamper with the IV
      const [iv, authTag, encryptedData] = encrypted.split(':');
      const tamperedIV = iv.slice(0, -2) + '00';
      const tamperedData = tamperedIV + ':' + authTag + ':' + encryptedData;
      
      expect(() => decrypt(tamperedData)).toThrow('Decryption failed');
    });

    it('should work with fallback secret', () => {
      delete process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      const plaintext = 'Test with fallback secret';
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for properly formatted encrypted strings', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      const plaintext = 'Test message';
      const encrypted = encrypt(plaintext);
      
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncrypted('plain text')).toBe(false);
      expect(isEncrypted('Hello, World!')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for strings with wrong number of parts', () => {
      expect(isEncrypted('single_part')).toBe(false);
      expect(isEncrypted('two:parts')).toBe(false);
      expect(isEncrypted('four:parts:here:now')).toBe(false);
    });

    it('should return false for strings with wrong IV length', () => {
      const shortIV = 'short:32_char_auth_tag_here_1234567890ab:encrypted_data';
      const longIV = 'very_long_iv_that_exceeds_expected_length_1234567890abcdef:32_char_auth_tag_here_1234567890ab:encrypted_data';
      
      expect(isEncrypted(shortIV)).toBe(false);
      expect(isEncrypted(longIV)).toBe(false);
    });

    it('should return false for strings with wrong auth tag length', () => {
      const shortAuthTag = '32_char_iv_here_1234567890abcdef:short:encrypted_data';
      const longAuthTag = '32_char_iv_here_1234567890abcdef:very_long_auth_tag_that_exceeds_expected_length_1234567890abcdef:encrypted_data';
      
      expect(isEncrypted(shortAuthTag)).toBe(false);
      expect(isEncrypted(longAuthTag)).toBe(false);
    });

    it('should return true for valid format even with empty encrypted data', () => {
      // Create a properly formatted string with correct hex lengths
      const validIV = '1234567890abcdef1234567890abcdef'; // 32 hex chars (16 bytes)
      const validAuthTag = '1234567890abcdef1234567890abcdef'; // 32 hex chars (16 bytes)
      const validFormat = `${validIV}:${validAuthTag}:`;
      
      expect(isEncrypted(validFormat)).toBe(true);
    });

    it('should handle various encrypted data lengths', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      
      const testCases = ['', 'short', 'medium length text', 'A'.repeat(1000)];
      
      testCases.forEach(plaintext => {
        const encrypted = encrypt(plaintext);
        expect(isEncrypted(encrypted)).toBe(true);
      });
    });
  });

  describe('validateEncryption', () => {
    it('should return true when encryption/decryption works correctly', () => {
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'test-secret-key';
      
      const result = validateEncryption();
      
      expect(result).toBe(true);
    });

    it('should return false when encryption fails', () => {
      // Mock encrypt to throw an error
      const originalCreateCipheriv = crypto.createCipheriv;
      vi.spyOn(crypto, 'createCipheriv').mockImplementation(() => {
        throw new Error('Encryption failed');
      });
      
      const result = validateEncryption();
      
      expect(result).toBe(false);
      
      // Restore original function
      crypto.createCipheriv = originalCreateCipheriv;
    });

    it('should return false when decryption fails', () => {
      // Mock createDecipheriv to throw an error
      const originalCreateDecipheriv = crypto.createDecipheriv;
      vi.spyOn(crypto, 'createDecipheriv').mockImplementation(() => {
        throw new Error('Decryption failed');
      });
      
      const result = validateEncryption();
      
      expect(result).toBe(false);
      
      // Restore original function
      crypto.createDecipheriv = originalCreateDecipheriv;
    });

    it('should work with different encryption secrets', () => {
      const secrets = ['secret1', 'secret2', 'very-long-secret-key-for-testing'];
      
      secrets.forEach(secret => {
        // Store current secret
        const originalSecret = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
        process.env.DEPLOYSTACK_ENCRYPTION_SECRET = secret;
        
        expect(validateEncryption()).toBe(true);
        
        // Restore original secret
        process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalSecret;
      });
    });

    it('should work with fallback secret', () => {
      const originalSecret = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      delete process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      
      const result = validateEncryption();
      
      expect(result).toBe(true);
      
      // Restore original secret
      if (originalSecret !== undefined) {
        process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalSecret;
      }
    });
  });

  describe('environment variable handling', () => {
    it('should log debug information in test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'debug-test-secret';
      
      encrypt('test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[TEST_ENV_ENCRYPTION_DEBUG] getEncryptionKey() using DEPLOYSTACK_ENCRYPTION_SECRET: "debug-test-secret"'
      );
    });

    it('should not log debug information in non-test environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'production-secret';
      
      encrypt('test message');
      
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should handle undefined environment variable', () => {
      delete process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      process.env.NODE_ENV = 'test';
      
      encrypt('test message');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[TEST_ENV_ENCRYPTION_DEBUG] getEncryptionKey() using DEPLOYSTACK_ENCRYPTION_SECRET: "undefined"'
      );
    });
  });

  describe('key derivation consistency', () => {
    it('should produce consistent keys for the same secret', () => {
      const originalSecret = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'consistent-secret';
      const plaintext = 'Test consistency';
      
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);
      
      // Should be able to decrypt both with the same key
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
      
      // Restore original secret
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalSecret;
    });

    it('should produce different keys for different secrets', () => {
      const originalSecret = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      const plaintext = 'Test message';
      
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'secret1';
      const encrypted1 = encrypt(plaintext);
      
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'secret2';
      const encrypted2 = encrypt(plaintext);
      
      // Should not be able to decrypt with wrong key
      expect(() => decrypt(encrypted1)).toThrow('Decryption failed');
      expect(decrypt(encrypted2)).toBe(plaintext);
      
      // Restore original secret
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalSecret;
    });
  });

  describe('round-trip testing', () => {
    it('should handle multiple round trips', () => {
      const originalSecret = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'round-trip-secret';
      const originalText = 'Multi-round trip test';
      
      let currentText = originalText;
      
      // Encrypt and decrypt multiple times
      for (let i = 0; i < 5; i++) {
        const encrypted = encrypt(currentText);
        currentText = decrypt(encrypted);
        expect(currentText).toBe(originalText);
      }
      
      // Restore original secret
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalSecret;
    });

    it('should handle nested encryption (encrypt already encrypted data)', () => {
      const originalSecret = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'nested-secret';
      const plaintext = 'Original message';
      
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(encrypted1);
      
      const decrypted1 = decrypt(encrypted2);
      const decrypted2 = decrypt(decrypted1);
      
      expect(decrypted2).toBe(plaintext);
      
      // Restore original secret
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalSecret;
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long encryption secrets', () => {
      const originalSecret = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'A'.repeat(1000);
      const plaintext = 'Test with long secret';
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
      
      // Restore original secret
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalSecret;
    });

    it('should handle special characters in encryption secret', () => {
      const originalSecret = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = '!@#$%^&*()_+{}|:"<>?[]\\;\',./ 中文';
      const plaintext = 'Test with special secret';
      
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
      
      // Restore original secret
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalSecret;
    });

    it('should handle JSON data', () => {
      const originalSecret = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'json-secret';
      const jsonData = JSON.stringify({
        user: 'john',
        password: 'secret123',
        settings: { theme: 'dark', notifications: true }
      });
      
      const encrypted = encrypt(jsonData);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(jsonData);
      expect(JSON.parse(decrypted)).toEqual({
        user: 'john',
        password: 'secret123',
        settings: { theme: 'dark', notifications: true }
      });
      
      // Restore original secret
      process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalSecret;
    });
  });
});
