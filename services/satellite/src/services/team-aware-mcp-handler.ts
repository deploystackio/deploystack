/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { McpProtocolHandler } from './mcp-protocol-handler';
import { DynamicConfigManager } from './dynamic-config-manager';
import { RemoteToolDiscoveryManager } from './remote-tool-discovery-manager';

/**
 * Team-Aware MCP Protocol Handler
 * Extends the base MCP handler to filter tools and servers based on team permissions
 */
export class TeamAwareMcpHandler {
  private logger: FastifyBaseLogger;
  private baseHandler: McpProtocolHandler;
  private configManager: DynamicConfigManager;
  private toolDiscoveryManager: RemoteToolDiscoveryManager;

  constructor(
    baseHandler: McpProtocolHandler, 
    configManager: DynamicConfigManager,
    toolDiscoveryManager: RemoteToolDiscoveryManager,
    logger: FastifyBaseLogger
  ) {
    this.baseHandler = baseHandler;
    this.configManager = configManager;
    this.toolDiscoveryManager = toolDiscoveryManager;
    this.logger = logger.child({ component: 'TeamAwareMcpHandler' });
  }

  /**
   * Handle MCP JSON-RPC request with team-aware filtering
   */
  async handleMcpRequest(message: any, sessionId?: string, teamId?: string): Promise<any> {
    const { method, params, id } = message;

    this.logger.debug({
      operation: 'team_aware_mcp_request',
      method,
      message_id: id,
      session_id: sessionId,
      team_id: teamId
    }, `Handling team-aware MCP request: ${method}`);

    try {
      let result: any;

      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params);
          break;
        
        case 'tools/list':
          result = await this.handleTeamAwareToolsList(teamId);
          break;
        
        case 'tools/call':
          result = await this.handleTeamAwareToolsCall(params, id, teamId);
          break;
        
        case 'resources/list':
          result = await this.handleResourcesList();
          break;
        
        case 'resources/templates/list':
          result = await this.handleResourceTemplatesList();
          break;
        
        case 'prompts/list':
          result = await this.handlePromptsList();
          break;
        
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      const response = {
        jsonrpc: '2.0',
        id,
        result
      };

      this.logger.debug({
        operation: 'team_aware_mcp_request_success',
        method,
        message_id: id,
        session_id: sessionId,
        team_id: teamId
      }, `Team-aware MCP request handled successfully: ${method}`);

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error({
        operation: 'team_aware_mcp_request_failed',
        method,
        message_id: id,
        session_id: sessionId,
        team_id: teamId,
        error: errorMessage
      }, `Team-aware MCP request failed: ${method} - ${errorMessage}`);

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal server error',
          data: errorMessage
        }
      };
    }
  }

  /**
   * Handle initialize request (same as base handler)
   */
  private async handleInitialize(params: any): Promise<any> {
    return this.baseHandler.handleMcpRequest({
      jsonrpc: '2.0',
      method: 'initialize',
      params,
      id: 'init'
    });
  }

  /**
   * Handle team-aware tools/list request - filter tools based on team's MCP server access
   */
  private async handleTeamAwareToolsList(teamId?: string): Promise<any> {
    this.logger.debug({
      operation: 'team_aware_tools_list',
      team_id: teamId
    }, 'Listing team-filtered tools from remote MCP servers');

    if (!teamId) {
      this.logger.warn({
        operation: 'team_aware_tools_list_no_team'
      }, 'No team ID provided for tools/list - returning empty list');
      
      return { tools: [] };
    }

    // Get all cached tools from tool discovery
    const allCachedTools = this.toolDiscoveryManager.getCachedTools();
    
    // Get team's allowed MCP servers from configuration
    const teamAllowedServers = this.getTeamAllowedServers(teamId);
    
    // Filter tools to only include those from team's allowed servers
    const teamFilteredTools = allCachedTools.filter(tool => {
      const isAllowed = teamAllowedServers.includes(tool.serverName);
      
      if (!isAllowed) {
        this.logger.debug({
          operation: 'tool_filtered_out',
          team_id: teamId,
          tool_name: tool.namespacedName,
          server_name: tool.serverName,
          allowed_servers: teamAllowedServers
        }, `Tool filtered out - server not allowed for team: ${tool.namespacedName}`);
      }
      
      return isAllowed;
    });

    // Convert to MCP tools format
    const tools = teamFilteredTools.map(tool => ({
      name: tool.namespacedName,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    const result = { tools };

    this.logger.info({
      operation: 'team_aware_tools_list_success',
      team_id: teamId,
      total_cached_tools: allCachedTools.length,
      team_allowed_servers: teamAllowedServers,
      team_filtered_tools: tools.length,
      tools: tools.map(t => t.name)
    }, `Returning ${tools.length} team-filtered tools (${allCachedTools.length} total available)`);

    return result;
  }

  /**
   * Handle team-aware tools/call request - verify team has access to the server
   */
  private async handleTeamAwareToolsCall(params: any, requestId: any, teamId?: string): Promise<any> {
    const { name: namespacedToolName, arguments: toolArgs } = params;

    if (!namespacedToolName) {
      throw new Error('Tool name is required');
    }

    if (!teamId) {
      throw new Error('Team authentication required for tool execution');
    }

    this.logger.info({
      operation: 'team_aware_tools_call',
      namespaced_tool_name: namespacedToolName,
      team_id: teamId,
      request_id: requestId
    }, `Team-aware tool call: ${namespacedToolName} for team ${teamId}`);

    // Find the cached tool to get the actual server name and verify team access
    const allCachedTools = this.toolDiscoveryManager.getCachedTools();
    const cachedTool = allCachedTools.find(tool => tool.namespacedName === namespacedToolName);
    
    if (!cachedTool) {
      throw new Error(`Tool not found: ${namespacedToolName}. Available tools: ${allCachedTools.map(t => t.namespacedName).join(', ')}`);
    }

    // Use the actual server name from the cached tool (e.g., "context7-john-R36no6FGoMFEZO9nWJJLT")
    const serverName = cachedTool.serverName;
    const originalToolName = cachedTool.originalName;

    // Check if team has access to this MCP server
    const teamAllowedServers = this.getTeamAllowedServers(teamId);
    
    if (!teamAllowedServers.includes(serverName)) {
      this.logger.warn({
        operation: 'team_tool_access_denied',
        team_id: teamId,
        server_name: serverName,
        namespaced_tool_name: namespacedToolName,
        team_allowed_servers: teamAllowedServers
      }, `Team ${teamId} does not have access to server ${serverName}`);

      throw new Error(`Access denied: Team does not have permission to use server '${serverName}'. Available servers: ${teamAllowedServers.join(', ')}`);
    }

    this.logger.info({
      operation: 'team_tool_access_granted',
      team_id: teamId,
      server_name: serverName,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName
    }, `Team ${teamId} has access to server ${serverName} - proceeding with tool call`);

    // Delegate to base handler for actual tool execution
    const baseRequest = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: namespacedToolName,
        arguments: toolArgs || {}
      },
      id: requestId
    };

    const baseResponse = await this.baseHandler.handleMcpRequest(baseRequest);
    
    // Return just the result (base handler returns full JSON-RPC response)
    if (baseResponse.error) {
      throw new Error(`Tool execution failed: ${baseResponse.error.message}`);
    }

    this.logger.info({
      operation: 'team_aware_tools_call_success',
      team_id: teamId,
      server_name: serverName,
      original_tool_name: originalToolName,
      namespaced_tool_name: namespacedToolName,
      request_id: requestId
    }, `Team-aware tool call successful: ${namespacedToolName} for team ${teamId}`);

    return baseResponse.result;
  }

  /**
   * Get team's allowed MCP servers from configuration
   * This should be populated from backend via the dynamic config system
   */
  private getTeamAllowedServers(teamId: string): string[] {
    // Get current MCP server configuration
    const currentConfig = this.configManager.getCurrentConfiguration();
    
    // For now, we'll filter based on server configuration that includes team information
    // In the future, this should come from backend team-MCP server mappings
    const allowedServers: string[] = [];
    
    for (const [serverName, serverConfig] of Object.entries(currentConfig.servers)) {
      // Check if server is enabled
      if (serverConfig.enabled === false) {
        continue;
      }

      // TODO: This is where team-specific filtering should happen
      // For now, we'll allow all enabled servers for all teams
      // In production, this should check against team-MCP server mappings from backend
      allowedServers.push(serverName);
    }

    this.logger.debug({
      operation: 'get_team_allowed_servers',
      team_id: teamId,
      total_servers: Object.keys(currentConfig.servers).length,
      enabled_servers: allowedServers.length,
      allowed_servers: allowedServers
    }, `Team ${teamId} has access to ${allowedServers.length} MCP servers`);

    return allowedServers;
  }

  /**
   * Handle resources/list request (delegate to base handler)
   */
  private async handleResourcesList(): Promise<any> {
    const response = await this.baseHandler.handleMcpRequest({
      jsonrpc: '2.0',
      method: 'resources/list',
      params: {},
      id: 'resources'
    });
    return response.result;
  }

  /**
   * Handle resources/templates/list request (delegate to base handler)
   */
  private async handleResourceTemplatesList(): Promise<any> {
    const response = await this.baseHandler.handleMcpRequest({
      jsonrpc: '2.0',
      method: 'resources/templates/list',
      params: {},
      id: 'resource-templates'
    });
    return response.result;
  }

  /**
   * Handle prompts/list request (delegate to base handler)
   */
  private async handlePromptsList(): Promise<any> {
    const response = await this.baseHandler.handleMcpRequest({
      jsonrpc: '2.0',
      method: 'prompts/list',
      params: {},
      id: 'prompts'
    });
    return response.result;
  }

  /**
   * Check if method is supported
   */
  isSupportedMethod(method: string): boolean {
    return this.baseHandler.isSupportedMethod(method);
  }

  /**
   * Get handler statistics with team-aware information
   */
  getStats(teamId?: string) {
    const baseStats = this.baseHandler.getStats();
    const configStats = this.configManager.getStats();
    
    let teamStats = {};
    if (teamId) {
      const teamAllowedServers = this.getTeamAllowedServers(teamId);
      const allCachedTools = this.toolDiscoveryManager.getCachedTools();
      const teamFilteredTools = allCachedTools.filter(tool => 
        teamAllowedServers.includes(tool.serverName)
      );
      
      teamStats = {
        team_id: teamId,
        team_allowed_servers: teamAllowedServers,
        team_available_tools: teamFilteredTools.length,
        team_tool_names: teamFilteredTools.map(t => t.namespacedName)
      };
    }
    
    return {
      ...baseStats,
      config_stats: configStats,
      team_stats: teamStats
    };
  }
}
