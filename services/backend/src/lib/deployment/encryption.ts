import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY_ENV = 'DEPLOYSTACK_ENCRYPTION_SECRET';

/**
 * Get encryption key from environment
 * Same key used for global settings encryption
 */
function getEncryptionKey(): Buffer {
  const key = process.env[ENCRYPTION_KEY_ENV];

  if (!key) {
    throw new Error(`${ENCRYPTION_KEY_ENV} environment variable is required for encryption`);
  }

  // Key must be 32 bytes for AES-256
  if (key.length !== 64) {
    throw new Error(`${ENCRYPTION_KEY_ENV} must be 64 hex characters (32 bytes)`);
  }

  return Buffer.from(key, 'hex');
}

/**
 * Encrypt deployment OAuth token
 * @param plaintext - Plain text token to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (base64)
 */
export function encryptDeploymentToken(plaintext: string): string {
  const key = getEncryptionKey();

  // Generate random IV (16 bytes)
  const iv = crypto.randomBytes(16);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get auth tag (for GCM mode)
  const authTag = cipher.getAuthTag();

  // Return format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt deployment OAuth token
 * @param encrypted - Encrypted string in format: iv:authTag:ciphertext (base64)
 * @returns Decrypted plain text token
 */
export function decryptDeploymentToken(encrypted: string): string {
  const key = getEncryptionKey();

  // Parse encrypted format: iv:authTag:ciphertext
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format (expected iv:authTag:ciphertext)');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
