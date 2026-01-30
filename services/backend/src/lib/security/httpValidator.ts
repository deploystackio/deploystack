/**
 * Security validation for HTTP/SSE MCP server configurations
 * Validates headers and URL query parameters to prevent header injection and URL manipulation
 */

import { ValidationResult, validResult, invalidResult } from './common';

/**
 * Blocked HTTP header names
 * These headers should not be user-configurable as they could:
 * - Cause request smuggling (Content-Length, Transfer-Encoding)
 * - Override critical connection behavior (Host, Connection)
 * - Enable proxy attacks (Proxy-*)
 */
export const BLOCKED_HEADERS = new Set([
  'host',
  'content-length',
  'transfer-encoding',
  'connection',
  'keep-alive',
  'upgrade',
  'expect',
  'proxy-connection',
  'proxy-authenticate',
  'proxy-authorization',
  'te', // Transfer-Encoding in hop-by-hop
  'trailer',
]);

/**
 * Valid pattern for HTTP header names
 * RFC 7230: token = 1*tchar
 * tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
 *         "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
 * For simplicity, we allow a common subset: alphanumeric and hyphens
 */
const VALID_HEADER_KEY_PATTERN = /^[A-Za-z0-9\-]+$/;

/**
 * Valid pattern for query parameter keys
 * More restrictive than general URL encoding - alphanumeric, underscore, hyphen
 */
const VALID_QUERY_KEY_PATTERN = /^[A-Za-z0-9_\-]+$/;

/**
 * Maximum length for header/query param key
 */
const MAX_KEY_LENGTH = 256;

/**
 * Maximum length for header value
 */
const MAX_HEADER_VALUE_LENGTH = 8192; // 8KB is reasonable for headers

/**
 * Maximum length for query param value
 */
const MAX_QUERY_VALUE_LENGTH = 2048; // 2KB should be plenty

/**
 * Maximum number of headers
 */
const MAX_HEADERS_COUNT = 50;

/**
 * Maximum number of query parameters
 */
const MAX_QUERY_PARAMS_COUNT = 50;

/**
 * Characters that are blocked in header values (CRLF injection prevention)
 */
const BLOCKED_HEADER_VALUE_CHARS = /[\r\n\x00]/;

/**
 * Control characters blocked in query param values
 */
const BLOCKED_QUERY_VALUE_CHARS = /[\x00-\x1f]/;

/**
 * Validates a single HTTP header key
 * @param key - The header name
 * @returns ValidationResult
 */
export function validateHeaderKey(key: string): ValidationResult {
  if (typeof key !== 'string' || !key) {
    return invalidResult('Header key must be a non-empty string', {
      type: 'INVALID_FORMAT',
      key,
      reason: 'Key must be a non-empty string'
    });
  }

  // Check length
  if (key.length > MAX_KEY_LENGTH) {
    return invalidResult(`Header key '${key.substring(0, 50)}...' exceeds maximum length of ${MAX_KEY_LENGTH}`, {
      type: 'INVALID_FORMAT',
      key: key.substring(0, 50) + '...',
      reason: `Key too long (${key.length} > ${MAX_KEY_LENGTH})`
    });
  }

  // Check against valid pattern
  if (!VALID_HEADER_KEY_PATTERN.test(key)) {
    return invalidResult(`Header key '${key}' contains invalid characters. Only alphanumeric characters and hyphens are allowed`, {
      type: 'INVALID_FORMAT',
      key,
      reason: 'Key contains invalid characters'
    });
  }

  // Check against blocklist (case-insensitive)
  const keyLower = key.toLowerCase();
  if (BLOCKED_HEADERS.has(keyLower)) {
    return invalidResult(`Header '${key}' is blocked for security reasons`, {
      type: 'BLOCKED_KEY',
      key,
      reason: 'This header could enable request smuggling or proxy attacks'
    });
  }

  return validResult();
}

/**
 * Validates a single HTTP header value
 * @param value - The header value
 * @param key - The header name (for error messages)
 * @returns ValidationResult
 */
export function validateHeaderValue(value: string, key: string): ValidationResult {
  if (typeof value !== 'string') {
    return invalidResult(`Header value for '${key}' must be a string`, {
      type: 'INVALID_FORMAT',
      key,
      reason: 'Value must be a string'
    });
  }

  // Check length
  if (value.length > MAX_HEADER_VALUE_LENGTH) {
    return invalidResult(`Header value for '${key}' exceeds maximum length of ${MAX_HEADER_VALUE_LENGTH}`, {
      type: 'INVALID_FORMAT',
      key,
      reason: `Value too long (${value.length} > ${MAX_HEADER_VALUE_LENGTH})`
    });
  }

  // Check for CRLF injection (header injection attack)
  if (BLOCKED_HEADER_VALUE_CHARS.test(value)) {
    return invalidResult(`Header value for '${key}' contains forbidden characters (CR, LF, or null byte)`, {
      type: 'BLOCKED_VALUE',
      key,
      reason: 'Value contains characters that could enable header injection'
    });
  }

  return validResult();
}

/**
 * Validates a complete set of HTTP headers
 * @param headers - Record of header key-value pairs
 * @returns ValidationResult
 */
export function validateHeaders(headers: Record<string, string>): ValidationResult {
  if (!headers || typeof headers !== 'object') {
    return invalidResult('Headers must be an object', {
      type: 'INVALID_FORMAT',
      reason: 'Expected object with string key-value pairs'
    });
  }

  const keys = Object.keys(headers);

  // Check count
  if (keys.length > MAX_HEADERS_COUNT) {
    return invalidResult(`Too many headers (${keys.length}). Maximum allowed: ${MAX_HEADERS_COUNT}`, {
      type: 'INVALID_FORMAT',
      reason: `Count ${keys.length} exceeds maximum ${MAX_HEADERS_COUNT}`
    });
  }

  // Validate each header
  for (const key of keys) {
    // Validate key
    const keyResult = validateHeaderKey(key);
    if (!keyResult.valid) {
      return keyResult;
    }

    // Validate value
    const valueResult = validateHeaderValue(headers[key], key);
    if (!valueResult.valid) {
      return valueResult;
    }
  }

  return validResult();
}

/**
 * Validates a single query parameter key
 * @param key - The parameter name
 * @returns ValidationResult
 */
export function validateQueryParamKey(key: string): ValidationResult {
  if (typeof key !== 'string' || !key) {
    return invalidResult('Query parameter key must be a non-empty string', {
      type: 'INVALID_FORMAT',
      key,
      reason: 'Key must be a non-empty string'
    });
  }

  // Check length
  if (key.length > MAX_KEY_LENGTH) {
    return invalidResult(`Query parameter key '${key.substring(0, 50)}...' exceeds maximum length of ${MAX_KEY_LENGTH}`, {
      type: 'INVALID_FORMAT',
      key: key.substring(0, 50) + '...',
      reason: `Key too long (${key.length} > ${MAX_KEY_LENGTH})`
    });
  }

  // Check against valid pattern
  if (!VALID_QUERY_KEY_PATTERN.test(key)) {
    return invalidResult(`Query parameter key '${key}' contains invalid characters. Only alphanumeric characters, underscores, and hyphens are allowed`, {
      type: 'INVALID_FORMAT',
      key,
      reason: 'Key contains invalid characters'
    });
  }

  return validResult();
}

/**
 * Validates a single query parameter value
 * @param value - The parameter value
 * @param key - The parameter name (for error messages)
 * @returns ValidationResult
 */
export function validateQueryParamValue(value: string, key: string): ValidationResult {
  if (typeof value !== 'string') {
    return invalidResult(`Query parameter value for '${key}' must be a string`, {
      type: 'INVALID_FORMAT',
      key,
      reason: 'Value must be a string'
    });
  }

  // Check length
  if (value.length > MAX_QUERY_VALUE_LENGTH) {
    return invalidResult(`Query parameter value for '${key}' exceeds maximum length of ${MAX_QUERY_VALUE_LENGTH}`, {
      type: 'INVALID_FORMAT',
      key,
      reason: `Value too long (${value.length} > ${MAX_QUERY_VALUE_LENGTH})`
    });
  }

  // Check for control characters
  if (BLOCKED_QUERY_VALUE_CHARS.test(value)) {
    return invalidResult(`Query parameter value for '${key}' contains forbidden control characters`, {
      type: 'BLOCKED_VALUE',
      key,
      reason: 'Value contains control characters'
    });
  }

  return validResult();
}

/**
 * Validates a complete set of URL query parameters
 * @param params - Record of query parameter key-value pairs
 * @returns ValidationResult
 */
export function validateQueryParams(params: Record<string, string>): ValidationResult {
  if (!params || typeof params !== 'object') {
    return invalidResult('Query parameters must be an object', {
      type: 'INVALID_FORMAT',
      reason: 'Expected object with string key-value pairs'
    });
  }

  const keys = Object.keys(params);

  // Check count
  if (keys.length > MAX_QUERY_PARAMS_COUNT) {
    return invalidResult(`Too many query parameters (${keys.length}). Maximum allowed: ${MAX_QUERY_PARAMS_COUNT}`, {
      type: 'INVALID_FORMAT',
      reason: `Count ${keys.length} exceeds maximum ${MAX_QUERY_PARAMS_COUNT}`
    });
  }

  // Validate each parameter
  for (const key of keys) {
    // Validate key
    const keyResult = validateQueryParamKey(key);
    if (!keyResult.valid) {
      return keyResult;
    }

    // Validate value
    const valueResult = validateQueryParamValue(params[key], key);
    if (!valueResult.valid) {
      return valueResult;
    }
  }

  return validResult();
}
