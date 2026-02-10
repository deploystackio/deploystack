import { McpServersConfig } from '../types/mcp-server';

/**
 * MCP Servers Configuration
 * Defines external MCP servers available for reverse proxy
 */
export const mcpServersConfig: McpServersConfig = {
  // Default settings for all servers
  defaultTimeout: 30000, // 30 seconds
  defaultHeaders: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; DeployStack-Satellite/1.0; +https://deploystack.io)'
  },

  // External MCP servers configuration
  servers: {
    // Context7 MCP Server
    'context7': {
      name: 'context7',
      type: 'http',
      url: 'https://mcp.context7.com/mcp',
      description: 'Context7 MCP Server for documentation and library information',
      timeout: 45000, // Longer timeout for documentation queries
      enabled: true,
      headers: {
        'Accept': 'application/json, text/event-stream'
      }
    },

    // Example Custom API MCP Server
    'custom-api': {
      name: 'custom-api',
      type: 'http',
      url: 'https://api.example.com/mcp',
      description: 'Custom API MCP Server example',
      enabled: false // Disabled by default
    },

    // Local development MCP server example
    'local-dev': {
      name: 'local-dev',
      type: 'http',
      url: 'http://localhost:8080/mcp',
      description: 'Local development MCP server for testing',
      timeout: 10000, // Shorter timeout for local server
      enabled: false // Disabled for now since server is not running
    }
  }
};

/**
 * Get enabled MCP servers
 */
export function getEnabledMcpServers() {
  return Object.entries(mcpServersConfig.servers)
    .filter(([, config]) => config.enabled !== false)
    .reduce((acc, [name, config]) => {
      acc[name] = config;
      return acc;
    }, {} as Record<string, typeof mcpServersConfig.servers[string]>);
}

/**
 * Get MCP server configuration by name
 */
export function getMcpServerConfig(serverName: string) {
  return mcpServersConfig.servers[serverName];
}

/**
 * Check if MCP server exists and is enabled
 */
export function isMcpServerEnabled(serverName: string): boolean {
  const config = getMcpServerConfig(serverName);
  return config ? config.enabled !== false : false;
}

/**
 * Get all available MCP server names
 */
export function getMcpServerNames(): string[] {
  return Object.keys(mcpServersConfig.servers);
}

/**
 * Get enabled MCP server names only
 */
export function getEnabledMcpServerNames(): string[] {
  return Object.keys(getEnabledMcpServers());
}
