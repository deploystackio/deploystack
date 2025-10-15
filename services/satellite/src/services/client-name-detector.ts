/**
 * Client Name Detection Utility
 * 
 * Derives human-readable client names from HTTP headers.
 * Used for MCP client activity tracking in personal dashboards.
 */

/**
 * Detect MCP client name from HTTP headers
 * 
 * This is a fallback mechanism when client_name is not available from
 * OAuth client metadata. In a future enhancement, we can look up the
 * client_name directly from the dynamicOauthClients table.
 * 
 * Detection Priority:
 * 1. Custom X-MCP-Client-Name header (if provided by client)
 * 2. Mcp-Session-Id header presence (indicates official MCP SDK)
 * 3. Parse User-Agent for known patterns
 * 4. Return 'Unknown Client' if no match
 * 
 * @param headers - HTTP headers from request
 * @returns Human-readable client name
 */
export function deriveClientName(headers: Record<string, string | string[] | undefined>): string {
  // Check for custom header (highest priority)
  const customName = getHeader(headers, 'x-mcp-client-name');
  if (customName) {
    return customName;
  }

  // Check for Mcp-Session-Id header - indicates official MCP SDK usage
  // The official MCP TypeScript SDK (used by VS Code, Cursor, etc.) sends this header
  const mcpSessionId = getHeader(headers, 'mcp-session-id');
  const userAgent = getHeader(headers, 'user-agent') || '';
  const ua = userAgent.toLowerCase();

  // If Mcp-Session-Id is present with 'undici' user-agent, it's likely VS Code or similar
  // The official @modelcontextprotocol/sdk uses undici as HTTP client
  if (mcpSessionId && ua === 'undici') {
    return 'VS Code';
  }

  // Cursor detection (if Cursor sets specific headers or user-agent)
  if (ua.includes('cursor')) {
    return 'Cursor';
  }

  // Claude Desktop detection
  if (ua.includes('claude')) {
    return 'Claude Desktop';
  }

  // Cline detection
  if (ua.includes('cline')) {
    return 'Cline';
  }

  // Windsurf detection
  if (ua.includes('windsurf')) {
    return 'Windsurf';
  }

  // Generic MCP SDK client (has mcp-session-id but unknown user-agent)
  if (mcpSessionId) {
    return 'MCP Client';
  }

  // VS Code detection (legacy, in case it appears in user-agent)
  if (ua.includes('vscode')) {
    return 'VS Code';
  }

  // Generic MCP reference in user-agent
  if (ua.includes('mcp')) {
    return 'MCP Client';
  }

  // Unknown
  return 'Unknown Client';
}

/**
 * Helper to safely extract header value
 * 
 * Headers can be string, string[], or undefined.
 * This normalizes to a single string or undefined.
 */
function getHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name];
  
  if (Array.isArray(value)) {
    return value[0];
  }
  
  return value;
}

/**
 * Extract session ID from Mcp-Session-Id header if present
 * 
 * This is an optional header that some MCP clients may send.
 * Used for request correlation in logs, not for session management.
 * 
 * @param headers - HTTP headers from request
 * @returns Session ID if present, undefined otherwise
 */
export function extractSessionId(headers: Record<string, string | string[] | undefined>): string | undefined {
  return getHeader(headers, 'mcp-session-id');
}

/**
 * Extract IP address from request
 * 
 * Checks X-Forwarded-For header first (for proxied requests),
 * then falls back to X-Real-IP, then remote address.
 * 
 * @param headers - HTTP headers
 * @param remoteAddress - Socket remote address
 * @returns IP address string
 */
export function extractIpAddress(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress: string | undefined
): string {
  // Check X-Forwarded-For (proxy)
  const xForwardedFor = getHeader(headers, 'x-forwarded-for');
  if (xForwardedFor) {
    // X-Forwarded-For can be a comma-separated list, take the first (original client)
    return xForwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP (some proxies)
  const xRealIp = getHeader(headers, 'x-real-ip');
  if (xRealIp) {
    return xRealIp;
  }

  // Fallback to socket remote address
  return remoteAddress || 'unknown';
}
