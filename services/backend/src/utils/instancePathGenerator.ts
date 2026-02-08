import crypto from 'crypto';
import { encrypt, decrypt } from './encryption';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Instance Path and Token Generator
 *
 * Utilities for generating unique instance paths (ngrok-style slugs) and secure tokens
 * for path-based MCP instance routing.
 */

// Word lists for ngrok-style path generation
const ADJECTIVES = [
  'aged', 'apt', 'big', 'bold', 'brave', 'calm', 'cool', 'dark', 'deep', 'dim',
  'dry', 'dull', 'fair', 'fast', 'fit', 'flat', 'glad', 'gold', 'good', 'gray',
  'hot', 'icy', 'keen', 'kind', 'lax', 'lean', 'live', 'long', 'loud', 'mad',
  'mild', 'neat', 'new', 'nice', 'odd', 'old', 'pale', 'pure', 'rare', 'raw',
  'red', 'rich', 'ripe', 'safe', 'sage', 'sad', 'shy', 'slim', 'sly', 'soft',
  'tall', 'tame', 'thin', 'true', 'vain', 'warm', 'weak', 'wet', 'wide', 'wild', 'wise'
];

const NOUNS = [
  'bear', 'bird', 'bush', 'cave', 'clam', 'coal', 'colt', 'crab', 'crow', 'dart',
  'dawn', 'deer', 'dove', 'drum', 'duck', 'dusk', 'edge', 'fawn', 'fern', 'fish',
  'frog', 'gale', 'goat', 'gull', 'hare', 'hawk', 'haze', 'hill', 'iris', 'jade',
  'kite', 'lace', 'lake', 'lamb', 'lark', 'leaf', 'lime', 'lion', 'lynx', 'mace',
  'mare', 'mist', 'moth', 'mule', 'newt', 'opal', 'orca', 'oryx', 'palm', 'peak',
  'pine', 'plum', 'pond', 'puma', 'rain', 'reef', 'rose', 'sage', 'seal', 'slug',
  'snow', 'swan', 'teal', 'tide', 'toad', 'vale', 'vine', 'wasp', 'wave', 'weed', 'wren', 'yeti', 'zinc'
];

/**
 * Generate a unique memorable instance path in ngrok-style format
 *
 * Format: {adjective}-{noun}-{hex4}
 * Example: "bold-penguin-42a3"
 *
 * Uniqueness: 61 adjectives × 63 nouns × 65536 hex values = ~252 million combinations
 * Database unique constraint ensures no collisions (caller should retry on conflict)
 *
 * @returns A memorable path string
 */
export function generateInstancePath(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const hex = crypto.randomBytes(2).toString('hex'); // 4 hex characters
  return `${adjective}-${noun}-${hex}`;
}

/**
 * Generate a secure instance access token with AES-256-GCM encryption
 *
 * Format: ds_inst_{64_hex_chars} (72 chars total)
 * Example: "ds_inst_a1b2c3d4e5f6..."
 *
 * Uses AES-256-GCM encryption (reversible) so the backend can:
 * 1. Decrypt and show the token to users in the UI
 * 2. Compute SHA-256 hash from decrypted token for satellite validation
 *
 * @param logger - Optional logger for encryption debug output
 * @returns Object with plaintext token and encrypted string
 */
export async function generateInstanceToken(logger?: FastifyBaseLogger): Promise<{ plaintext: string; encrypted: string }> {
  // Generate 32 random bytes → 64 hex chars
  const randomHex = crypto.randomBytes(32).toString('hex');
  const plaintext = `ds_inst_${randomHex}`;

  // Encrypt with AES-256-GCM (reversible, same as OAuth token storage)
  const encrypted = encrypt(plaintext, logger);

  return { plaintext, encrypted };
}

/**
 * Decrypt a stored instance token
 *
 * @param encryptedToken - The AES-256-GCM encrypted token from the database
 * @param logger - Optional logger for decryption debug output
 * @returns The plaintext token, or null if decryption fails
 */
export function decryptInstanceToken(encryptedToken: string, logger?: FastifyBaseLogger): string | null {
  try {
    return decrypt(encryptedToken, logger);
  } catch {
    return null;
  }
}
