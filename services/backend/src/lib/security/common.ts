/**
 * Common types and utilities for security validation
 */

/**
 * Result of a security validation operation
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: ValidationErrorDetails;
}

/**
 * Detailed information about validation errors for debugging/logging
 */
export interface ValidationErrorDetails {
  type: 'BLOCKED_PATTERN' | 'INVALID_FORMAT' | 'BLOCKED_KEY' | 'BLOCKED_VALUE' | 'INVALID_COMMAND';
  index?: number;
  key?: string;
  value?: string;
  reason: string;
}

/**
 * Creates a successful validation result
 */
export function validResult(): ValidationResult {
  return { valid: true };
}

/**
 * Creates a failed validation result
 */
export function invalidResult(
  error: string,
  details?: ValidationErrorDetails
): ValidationResult {
  return {
    valid: false,
    error,
    details
  };
}
