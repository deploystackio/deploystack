import { z } from 'zod';

// Claude Desktop configuration schema (shared) - supports both stdio and HTTP
export const claudeDesktopConfigSchema = z.object({
  mcpServers: z.record(z.string(), z.union([
    // stdio/local server configuration
    z.object({
      command: z.string().min(1, 'Command is required'),
      args: z.array(z.string()),
      env: z.record(z.string(), z.string()).optional()
    }),
    // HTTP/remote server configuration
    z.object({
      url: z.string().url('Valid URL is required'),
      type: z.enum(['streamableHttp', 'http', 'sse']),
      headers: z.record(z.string(), z.string()).optional()
    })
  ]))
}).refine(
  (config) => Object.keys(config.mcpServers).length === 1,
  { message: "Claude Desktop config must contain exactly one MCP server" }
);

export type ClaudeDesktopConfig = z.infer<typeof claudeDesktopConfigSchema>;

/**
 * Extract transport_type from Claude Desktop configuration
 * @param claudeConfig - The claude desktop configuration object
 * @returns Transport type: 'stdio' | 'http' | 'sse'
 */
export function extractTransportTypeFromClaudeConfig(claudeConfig: ClaudeDesktopConfig): 'stdio' | 'http' | 'sse' {
  const serverKey = Object.keys(claudeConfig.mcpServers)[0];
  const serverConfig = claudeConfig.mcpServers[serverKey];
  
  // Check if it's HTTP/remote configuration
  if ('url' in serverConfig && 'type' in serverConfig) {
    // Map Claude Desktop type to our transport_type
    switch (serverConfig.type) {
      case 'streamableHttp':
      case 'http':
        return 'http';
      case 'sse':
        return 'sse';
      default:
        return 'http'; // Default for URL-based configs
    }
  }
  
  // For stdio/local configuration
  if ('command' in serverConfig) {
    const command = serverConfig.command?.toLowerCase() || '';
    
    // Standard CLI commands indicate stdio transport
    const stdioCommands = ['npx', 'node', 'python', 'python3', 'pip', 'poetry', 'cargo', 'go', 'java', 'dotnet'];
    if (stdioCommands.some(cmd => command.includes(cmd))) {
      return 'stdio';
    }
  }
  
  // Default to stdio as it's the most common
  return 'stdio';
}

/**
 * Extract complete MCP configuration data from Claude Desktop config
 * @param claudeConfig - The claude desktop configuration object
 * @returns Object containing installation_methods, environment_variables, args, headers, and transport_type
 */
export function extractMcpConfigData(claudeConfig: ClaudeDesktopConfig) {
  const serverKey = Object.keys(claudeConfig.mcpServers)[0];
  const serverConfig = claudeConfig.mcpServers[serverKey];
  
  // Check if it's HTTP/remote configuration
  if ('url' in serverConfig && 'type' in serverConfig) {
    // HTTP/Remote server configuration
    const installation_methods = [{
      client: "claude-desktop",
      url: serverConfig.url,
      type: serverConfig.type,
      headers: serverConfig.headers || {}
    }];
    
    // Extract headers metadata
    const headers = Object.keys(serverConfig.headers || {}).map(headerKey => ({
      name: headerKey,
      description: `${headerKey} header`,
      required: true,
      type: "secret",
      validation: "",
      placeholder: serverConfig.headers![headerKey]
    }));
    
    // No args or env for HTTP configs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const environment_variables: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args: any[] = [];
    
    const transport_type = extractTransportTypeFromClaudeConfig(claudeConfig);
    
    return { installation_methods, environment_variables, args, headers, transport_type };
  }
  
  // stdio/local server configuration
  if ('command' in serverConfig) {
    const installation_methods = [{
      client: "claude-desktop",
      command: serverConfig.command,
      args: serverConfig.args,
      env: serverConfig.env || {}
    }];
    
    // Extract environment_variables metadata
    const environment_variables = Object.keys(serverConfig.env || {}).map(envKey => ({
      name: envKey,
      description: `${envKey} environment variable`,
      required: true,
      type: "password",
      validation: "",
      placeholder: serverConfig.env![envKey]
    }));
    
    // Extract args metadata - define schema for each argument
    const args = serverConfig.args.map((arg, index) => ({
      name: `arg_${index}`,
      description: `Command argument: ${arg}`,
      default_value: arg,
      required: true,
      type: "string",
      position: index
    }));
    
    // No headers for stdio configs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers: any[] = [];
    
    const transport_type = extractTransportTypeFromClaudeConfig(claudeConfig);
    
    return { installation_methods, environment_variables, args, headers, transport_type };
  }
  
  // Fallback (shouldn't happen with proper validation)
  const transport_type = extractTransportTypeFromClaudeConfig(claudeConfig);
  return { installation_methods: [], environment_variables: [], args: [], headers: [], transport_type };
}
