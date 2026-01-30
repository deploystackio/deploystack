/**
 * Security validation library for MCP server configurations
 *
 * This module provides validators to prevent security vulnerabilities:
 * - Command injection in stdio servers
 * - nsjail sandbox bypass via argument manipulation
 * - Library/code injection via environment variables
 * - HTTP header injection (CRLF)
 * - URL manipulation in query parameters
 *
 * Use these validators before storing user-provided configuration in the database.
 */

// Common types and utilities
export {
  ValidationResult,
  ValidationErrorDetails,
  validResult,
  invalidResult
} from './common';

// Stdio validation (commands and arguments)
export {
  ALLOWED_COMMANDS,
  validateCommand,
  validateArgs,
  validateStdioConfig
} from './stdioValidator';

// Environment variable validation
export {
  BLOCKED_ENV_VARS,
  validateEnvKey,
  validateEnvValue,
  validateEnvVars
} from './envValidator';

// HTTP headers and query params validation
export {
  BLOCKED_HEADERS,
  validateHeaderKey,
  validateHeaderValue,
  validateHeaders,
  validateQueryParamKey,
  validateQueryParamValue,
  validateQueryParams
} from './httpValidator';
