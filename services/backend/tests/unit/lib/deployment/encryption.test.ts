import { describe, it, expect, beforeAll } from 'vitest';
import { encryptDeploymentToken, decryptDeploymentToken } from '../../../../src/lib/deployment/encryption';

describe('Deployment Token Encryption', () => {
  beforeAll(() => {
    // Set encryption key for tests
    process.env.DEPLOYSTACK_ENCRYPTION_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  it('should encrypt and decrypt token correctly', () => {
    const plaintext = 'gho_test_oauth_token_123456';

    const encrypted = encryptDeploymentToken(plaintext);
    expect(encrypted).toContain(':'); // Format: iv:authTag:ciphertext

    const decrypted = decryptDeploymentToken(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should generate different ciphertext for same plaintext', () => {
    const plaintext = 'same_token';

    const encrypted1 = encryptDeploymentToken(plaintext);
    const encrypted2 = encryptDeploymentToken(plaintext);

    // Different IVs = different ciphertext
    expect(encrypted1).not.toBe(encrypted2);

    // But both decrypt to same plaintext
    expect(decryptDeploymentToken(encrypted1)).toBe(plaintext);
    expect(decryptDeploymentToken(encrypted2)).toBe(plaintext);
  });

  it('should throw error with invalid format', () => {
    expect(() => {
      decryptDeploymentToken('invalid_format');
    }).toThrow('Invalid encrypted token format');
  });

  it('should throw error with missing encryption key', () => {
    const originalKey = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
    delete process.env.DEPLOYSTACK_ENCRYPTION_SECRET;

    expect(() => {
      encryptDeploymentToken('test');
    }).toThrow('DEPLOYSTACK_ENCRYPTION_SECRET environment variable is required');

    // Restore
    process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalKey;
  });

  it('should throw error with wrong length encryption key', () => {
    const originalKey = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
    process.env.DEPLOYSTACK_ENCRYPTION_SECRET = 'tooshort';

    expect(() => {
      encryptDeploymentToken('test');
    }).toThrow('DEPLOYSTACK_ENCRYPTION_SECRET must be 64 hex characters');

    // Restore
    process.env.DEPLOYSTACK_ENCRYPTION_SECRET = originalKey;
  });

  it('should handle long OAuth tokens', () => {
    const longToken = 'gho_' + 'a'.repeat(200);

    const encrypted = encryptDeploymentToken(longToken);
    const decrypted = decryptDeploymentToken(encrypted);

    expect(decrypted).toBe(longToken);
  });

  it('should handle special characters in tokens', () => {
    const specialToken = 'token_with-special.chars@123!$%^&*()';

    const encrypted = encryptDeploymentToken(specialToken);
    const decrypted = decryptDeploymentToken(encrypted);

    expect(decrypted).toBe(specialToken);
  });
});
