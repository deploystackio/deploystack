/**
 * Utilities for masking sensitive information in logs
 */

/**
 * Masks sensitive query parameters in URL for logging purposes.
 * Only masks parameters that are marked as secrets in the configuration.
 *
 * @param url - Full URL with query parameters
 * @param secretParamNames - Array of query parameter names that should be masked
 * @returns URL string with masked secret query parameters (first 3 chars + *****)
 *
 * @example
 * maskUrlForLogging(
 *   'https://api.example.com/mcp?token=sk_abc123xyz789&region=us-east-1',
 *   ['token']
 * )
 * // Returns: 'https://api.example.com/mcp?token=sk_*****&region=us-east-1'
 */
export function maskUrlForLogging(
  url: string | undefined,
  secretParamNames?: string[]
): string {
  if (!url) return 'undefined';
  if (!secretParamNames || secretParamNames.length === 0) return url;

  try {
    const urlObj = new URL(url);

    secretParamNames.forEach(paramName => {
      const value = urlObj.searchParams.get(paramName);
      if (value) {
        const masked = value.length > 3
          ? value.substring(0, 3) + '*****'
          : '***';
        urlObj.searchParams.set(paramName, masked);
      }
    });

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original URL
    return url;
  }
}

/**
 * Masks sensitive headers for logging purposes.
 * Only masks headers that are marked as secrets in the configuration.
 *
 * @param headers - Record of header names to values
 * @param secretHeaderNames - Array of header names that should be masked
 * @returns New headers object with masked secret values (first 3 chars + *****)
 *
 * @example
 * maskHeadersForLogging(
 *   { 'Authorization': 'Bearer sk_abc123xyz789', 'Content-Type': 'application/json' },
 *   ['Authorization']
 * )
 * // Returns: { 'Authorization': 'Bea*****', 'Content-Type': 'application/json' }
 */
export function maskHeadersForLogging(
  headers: Record<string, string> | undefined,
  secretHeaderNames?: string[]
): Record<string, string> | undefined {
  if (!headers || !secretHeaderNames || secretHeaderNames.length === 0) {
    return headers;
  }

  const masked = { ...headers };
  secretHeaderNames.forEach(headerName => {
    // Case-insensitive header name matching
    const actualHeaderName = Object.keys(masked).find(
      key => key.toLowerCase() === headerName.toLowerCase()
    );

    if (actualHeaderName && masked[actualHeaderName]) {
      const value = masked[actualHeaderName];
      masked[actualHeaderName] = value.length > 3
        ? value.substring(0, 3) + '*****'
        : '***';
    }
  });

  return masked;
}

/**
 * Masks sensitive environment variables for logging purposes.
 * Only masks env vars that are marked as secrets in the configuration.
 *
 * @param env - Record of environment variable names to values
 * @param secretEnvNames - Array of env var names that should be masked
 * @returns New env object with masked secret values (first 3 chars + *****)
 *
 * @example
 * maskEnvForLogging(
 *   { 'API_KEY': 'sk_abc123xyz789', 'DEBUG': 'true' },
 *   ['API_KEY']
 * )
 * // Returns: { 'API_KEY': 'sk_*****', 'DEBUG': 'true' }
 */
export function maskEnvForLogging(
  env: Record<string, string> | undefined,
  secretEnvNames?: string[]
): Record<string, string> | undefined {
  if (!env || !secretEnvNames || secretEnvNames.length === 0) {
    return env;
  }

  const masked = { ...env };
  secretEnvNames.forEach(envName => {
    if (masked[envName]) {
      const value = masked[envName];
      masked[envName] = value.length > 3
        ? value.substring(0, 3) + '*****'
        : '***';
    }
  });

  return masked;
}
