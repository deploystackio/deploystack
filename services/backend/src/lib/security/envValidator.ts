/**
 * Security validation for environment variables
 * Blocks dangerous env vars that could be used for code/library injection
 *
 * This mirrors the BLOCKED_ENV_VARS in satellite's nsjail.ts for defense-in-depth
 */

import { ValidationResult, validResult, invalidResult } from './common';

/**
 * Blocked Environment Variables
 * These env vars are stripped from user-provided config before passing to nsjail.
 * They can be exploited for code injection, library hijacking, or privilege escalation.
 *
 * Synchronized with services/satellite/src/config/nsjail.ts BLOCKED_ENV_VARS
 */
export const BLOCKED_ENV_VARS = new Set([
  // Linux dynamic linker (affects ALL processes)
  'LD_PRELOAD',           // Shared library injection - most dangerous
  'LD_LIBRARY_PATH',      // Library search path hijacking
  'LD_AUDIT',             // Audit library injection
  'LD_DEBUG',             // Debug output manipulation
  'LD_DEBUG_OUTPUT',      // Debug output file
  'LD_PROFILE',           // Profiling library injection
  'LD_SHOW_AUXV',         // Auxiliary vector exposure
  'LD_DYNAMIC_WEAK',      // Weak symbol manipulation

  // Node.js specific
  'NODE_OPTIONS',         // Can inject --require, --inspect, etc.
  'NODE_REPL_EXTERNAL_MODULE', // External module loading
  'NODE_EXTRA_CA_CERTS',  // Could point to malicious CA cert
  'NODE_PATH',            // Module resolution hijacking
  'NODE_REDIRECT_WARNINGS', // Warning output redirection

  // Python specific
  'PYTHONSTARTUP',        // Executes script on Python interpreter start
  'PYTHONPATH',           // Module resolution hijacking
  'PYTHONHOME',           // Python installation path hijacking
  'PYTHONWARNINGS',       // Warning behavior manipulation
  'PYTHONDEBUG',          // Debug mode enabling
  'PYTHONINSPECT',        // Forces interactive mode after script
  'PYTHONUSERSITE',       // User site-packages manipulation
  'PYTHONEXECUTABLE',     // Executable path override
  'PYTHONHASHSEED',       // Hash randomization control

  // Shell injection (if any subprocess spawns shell)
  'BASH_ENV',             // Executed on non-interactive bash start
  'ENV',                  // Executed on sh start
  'ZDOTDIR',              // Zsh config directory override
  'SHELL',                // Default shell override

  // Path and temp manipulation (already set by nsjail)
  'PATH',                 // Already controlled by nsjail
  'HOME',                 // Already set by nsjail
  'TMPDIR',               // Could redirect temp to attacker location
  'TMP',                  // Windows-style temp
  'TEMP',                 // Windows-style temp

  // Misc dangerous
  'IFS',                  // Shell word splitting manipulation
]);

/**
 * Valid pattern for environment variable keys
 * Standard POSIX: uppercase letters, digits, and underscores; cannot start with digit
 */
const VALID_ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Maximum length for environment variable key
 */
const MAX_ENV_KEY_LENGTH = 256;

/**
 * Maximum length for environment variable value
 */
const MAX_ENV_VALUE_LENGTH = 32768; // 32KB should be more than enough

/**
 * Maximum number of environment variables
 */
const MAX_ENV_VARS_COUNT = 100;

/**
 * Validates a single environment variable key
 * @param key - The environment variable name
 * @returns ValidationResult
 */
export function validateEnvKey(key: string): ValidationResult {
  if (typeof key !== 'string' || !key) {
    return invalidResult('Environment variable key must be a non-empty string', {
      type: 'INVALID_FORMAT',
      key,
      reason: 'Key must be a non-empty string'
    });
  }

  // Check length
  if (key.length > MAX_ENV_KEY_LENGTH) {
    return invalidResult(`Environment variable key '${key.substring(0, 50)}...' exceeds maximum length of ${MAX_ENV_KEY_LENGTH}`, {
      type: 'INVALID_FORMAT',
      key: key.substring(0, 50) + '...',
      reason: `Key too long (${key.length} > ${MAX_ENV_KEY_LENGTH})`
    });
  }

  // Check against valid pattern
  if (!VALID_ENV_KEY_PATTERN.test(key)) {
    return invalidResult(`Environment variable key '${key}' contains invalid characters. Only letters, digits, and underscores are allowed (cannot start with digit)`, {
      type: 'INVALID_FORMAT',
      key,
      reason: 'Key contains invalid characters'
    });
  }

  // Check against blocklist (case-insensitive for safety)
  const keyUpper = key.toUpperCase();
  if (BLOCKED_ENV_VARS.has(key) || BLOCKED_ENV_VARS.has(keyUpper)) {
    return invalidResult(`Environment variable '${key}' is blocked for security reasons`, {
      type: 'BLOCKED_KEY',
      key,
      reason: 'This environment variable can be used for code/library injection'
    });
  }

  return validResult();
}

/**
 * Validates a single environment variable value
 * @param value - The environment variable value
 * @param key - The key (for error messages)
 * @returns ValidationResult
 */
export function validateEnvValue(value: string, key: string): ValidationResult {
  if (typeof value !== 'string') {
    return invalidResult(`Environment variable value for '${key}' must be a string`, {
      type: 'INVALID_FORMAT',
      key,
      reason: 'Value must be a string'
    });
  }

  // Check length
  if (value.length > MAX_ENV_VALUE_LENGTH) {
    return invalidResult(`Environment variable value for '${key}' exceeds maximum length of ${MAX_ENV_VALUE_LENGTH}`, {
      type: 'INVALID_FORMAT',
      key,
      reason: `Value too long (${value.length} > ${MAX_ENV_VALUE_LENGTH})`
    });
  }

  // Values are generally safe - they're strings passed to the environment
  // The blocklist on keys is the primary protection

  return validResult();
}

/**
 * Validates a complete set of environment variables
 * @param env - Record of environment variable key-value pairs
 * @returns ValidationResult
 */
export function validateEnvVars(env: Record<string, string>): ValidationResult {
  if (!env || typeof env !== 'object') {
    return invalidResult('Environment variables must be an object', {
      type: 'INVALID_FORMAT',
      reason: 'Expected object with string key-value pairs'
    });
  }

  const keys = Object.keys(env);

  // Check count
  if (keys.length > MAX_ENV_VARS_COUNT) {
    return invalidResult(`Too many environment variables (${keys.length}). Maximum allowed: ${MAX_ENV_VARS_COUNT}`, {
      type: 'INVALID_FORMAT',
      reason: `Count ${keys.length} exceeds maximum ${MAX_ENV_VARS_COUNT}`
    });
  }

  // Validate each key-value pair
  for (const key of keys) {
    // Validate key
    const keyResult = validateEnvKey(key);
    if (!keyResult.valid) {
      return keyResult;
    }

    // Validate value
    const valueResult = validateEnvValue(env[key], key);
    if (!valueResult.valid) {
      return valueResult;
    }
  }

  return validResult();
}
