import crypto from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Derive encryption key from environment variable
 * Uses scrypt for key derivation with a fixed salt
 */
function getEncryptionKey(logger?: FastifyBaseLogger): Buffer {
  const secretFromEnv = process.env.DEPLOYSTACK_ENCRYPTION_SECRET;
  if (process.env.NODE_ENV === 'test' && logger) {
    logger.debug({
      secretFromEnv,
      operation: 'get_encryption_key',
      environment: 'test'
    }, '[TEST_ENV_ENCRYPTION_DEBUG] getEncryptionKey() using DEPLOYSTACK_ENCRYPTION_SECRET');
  }
  const secret = secretFromEnv || 'fallback-secret-key-change-in-production-immediately';
  // Use a fixed salt for consistent key derivation
  const salt = 'deploystack-global-settings-salt';
  const derivedKey = crypto.scryptSync(secret, salt, KEY_LENGTH);
  // Debug logging for derived key can be added here if needed for testing
  if (process.env.NODE_ENV === 'test' && logger) {
    logger.debug({
      derivedKeyPreview: derivedKey.subarray(0, 4).toString('hex'),
      operation: 'get_encryption_key',
      environment: 'test'
    }, '[TEST_ENV_ENCRYPTION_DEBUG] Derived key (first 4 bytes hex)');
  }
  return derivedKey;
}

/**
 * Encrypt a plaintext string
 * @param text - The plaintext to encrypt
 * @param logger - Optional logger for debug output
 * @returns Encrypted string in format: iv:authTag:encryptedData (all hex encoded)
 */
export function encrypt(text: string, logger?: FastifyBaseLogger): string {
  try {
    const key = getEncryptionKey(logger);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Set additional authenticated data (AAD) for extra security
    const aad = Buffer.from('deploystack-global-settings', 'utf8');
    cipher.setAAD(aad);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypt an encrypted string
 * @param encryptedData - The encrypted string in format: iv:authTag:encryptedData
 * @param logger - Optional logger for debug output
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: string, logger?: FastifyBaseLogger): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format. Expected format: iv:authTag:encryptedData');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    const key = getEncryptionKey(logger);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Set the same AAD used during encryption
    const aad = Buffer.from('deploystack-global-settings', 'utf8');
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if a string appears to be encrypted (has the expected format)
 * @param value - The string to check
 * @returns True if the string appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && 
         parts[0].length === IV_LENGTH * 2 && // IV should be 32 hex chars
         parts[1].length === TAG_LENGTH * 2;  // Auth tag should be 32 hex chars
}

/**
 * Validate that encryption/decryption is working correctly
 * Used for testing and health checks
 */
export function validateEncryption(logger?: FastifyBaseLogger): boolean {
  try {
    const testData = 'test-encryption-validation';
    const encrypted = encrypt(testData, logger);
    const decrypted = decrypt(encrypted, logger);
    return decrypted === testData;
  } catch {
    return false;
  }
}
