import { z } from 'zod';

// Claude Desktop configuration schema (shared)
export const claudeDesktopConfigSchema = z.object({
  mcpServers: z.record(z.string(), z.object({
    command: z.string().min(1, 'Command is required'),
    args: z.array(z.string()),
    env: z.record(z.string(), z.string()).optional()
  }))
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
  const command = serverConfig.command?.toLowerCase() || '';
  
  // Standard CLI commands indicate stdio transport
  const stdioCommands = ['npx', 'node', 'python', 'python3', 'pip', 'poetry', 'cargo', 'go', 'java', 'dotnet'];
  if (stdioCommands.some(cmd => command.includes(cmd))) {
    return 'stdio';
  }
  
  // Future: Could add logic for http/sse detection if needed
  // if (command.includes('http') || command.includes('serve')) {
  //   return 'http';
  // }
  
  // Default to stdio as it's the most common
  return 'stdio';
}

/**
 * Extract complete MCP configuration data from Claude Desktop config
 * @param claudeConfig - The claude desktop configuration object
 * @returns Object containing installation_methods, environment_variables, and transport_type
 */
export function extractMcpConfigData(claudeConfig: ClaudeDesktopConfig) {
  const serverKey = Object.keys(claudeConfig.mcpServers)[0];
  const serverConfig = claudeConfig.mcpServers[serverKey];
  
  // Extract installation_methods (Claude Desktop format)
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
  
  // Extract transport_type
  const transport_type = extractTransportTypeFromClaudeConfig(claudeConfig);
  
  return { installation_methods, environment_variables, transport_type };
}
