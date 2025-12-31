/**
 * MCP Server Configuration Types
 * Defines the structure for configuring external MCP servers for reverse proxy
 */

export interface McpServerConfig {
  /** Unique identifier for the MCP server */
  name: string;
  
  /** Server deployment type - supports 'http', 'stdio', 'sse' */
  type?: 'http' | 'stdio' | 'sse';
  
  /** Transport type (alternative to type) */
  transport_type?: 'http' | 'stdio' | 'sse';
  
  /** Base URL of the external MCP server (required for http/sse) */
  url?: string;
  
  /** Command to execute (required for stdio) */
  command?: string;
  
  /** Command arguments (required for stdio) */
  args?: string[];
  
  /** Environment variables (for stdio) */
  env?: Record<string, string>;
  
  /** Optional HTTP headers to include in requests (for http/sse) */
  headers?: Record<string, string>;

  /** URL query parameters to append to URL (for http/sse) */
  url_query_params?: Record<string, string>;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  
  /** Whether this server is enabled (default: true) */
  enabled?: boolean;
  
  /** Optional description for documentation */
  description?: string;
  
  /** Installation ID from backend */
  installation_id?: string;

  /** Instance ID from backend (per-user instance) */
  instance_id?: string;

  /** Team ID that owns this installation */
  team_id?: string;
  
  /** Team slug for identification */
  team_slug?: string;
  
  /** Server name from backend */
  server_name?: string;
  
  /** Server slug from backend */
  server_slug?: string;
  
  /** Installation name from backend */
  installation_name?: string;

  /** User ID that owns this instance (per-user process) */
  user_id?: string;

  /** Metadata about which fields contain secrets (for secure logging) */
  secret_metadata?: {
    /** Names of query parameters that are secrets */
    query_params?: string[];
    /** Names of headers that are secrets */
    headers?: string[];
    /** Names of environment variables that are secrets */
    env?: string[];
  };
}

export interface McpServersConfig {
  /** Collection of configured MCP servers */
  servers: Record<string, McpServerConfig>;
  
  /** Default timeout for all servers (can be overridden per server) */
  defaultTimeout?: number;
  
  /** Default headers for all servers (can be extended per server) */
  defaultHeaders?: Record<string, string>;
}

export interface ProxyRequestContext {
  /** Original MCP server name being proxied to */
  serverName: string;
  
  /** MCP method being called */
  method: string;
  
  /** Request ID for correlation */
  requestId?: string | number | null;
  
  /** Session ID if using session-based transport */
  sessionId?: string;
  
  /** Transport type used by client */
  transport: 'sse' | 'streamable-http' | 'direct-http';
}

export interface ProxyResponse {
  /** Whether the proxy request was successful */
  success: boolean;
  
  /** Response data from the upstream MCP server */
  data?: unknown;
  
  /** Error message if proxy failed */
  error?: string;
  
  /** HTTP status code from upstream server */
  statusCode?: number;
  
  /** Response time in milliseconds */
  responseTime?: number;
}
