/**
 * Token Counter Utility
 *
 * Estimates token consumption for MCP servers and their tools using gpt-tokenizer.
 * This is provider-agnostic and uses OpenAI's tokenization approach as a standard baseline.
 *
 * Key use case: Understanding context window usage when adding MCP servers to AI assistants.
 */

import { encode } from 'gpt-tokenizer';

/**
 * MCP Tool definition matching the Model Context Protocol specification
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description?: string;
  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;
}

/**
 * MCP Server with collection of tools
 */
export interface MCPServer {
  /** Server name/identifier */
  name: string;
  /** Array of tool definitions */
  tools: MCPTool[];
}

/**
 * Token estimate for a single tool
 */
export interface ToolTokenEstimate {
  /** Tool name */
  name: string;
  /** Total token count for this tool */
  tokens: number;
  /** Tool description (truncated to 100 chars) */
  description: string;
  /** Complexity classification */
  complexity: 'simple' | 'medium' | 'complex' | 'very-complex';
}

/**
 * Token estimate for an entire MCP server
 */
export interface ServerTokenEstimate {
  /** Server name */
  serverName: string;
  /** Number of tools in this server */
  toolCount: number;
  /** Total tokens consumed by all tools */
  totalTokens: number;
  /** Average tokens per tool */
  averagePerTool: number;
  /** Minimum tokens (smallest tool) */
  minTokens: number;
  /** Maximum tokens (largest tool) */
  maxTokens: number;
  /** Individual tool estimates */
  tools: ToolTokenEstimate[];
  /** Overall server complexity */
  complexity: 'simple' | 'medium' | 'complex' | 'very-complex';
}

/**
 * Context window usage analysis
 */
export interface ContextWindowAnalysis {
  /** Context window size used for analysis (e.g., 200000 for Claude) */
  contextWindowSize: number;
  /** Total number of MCP servers analyzed */
  totalServers: number;
  /** Total number of tools across all servers */
  totalTools: number;
  /** Total tokens consumed by all tools */
  totalTokens: number;
  /** Percentage of context window utilized */
  utilizationPercent: number;
  /** Remaining tokens available */
  remainingTokens: number;
  /** Per-server breakdown */
  serversBreakdown: ServerTokenEstimate[];
  /** Recommendation based on utilization */
  recommendation: string;
}

/**
 * Hierarchical routing savings analysis
 */
export interface HierarchicalSavings {
  /** Traditional approach metrics */
  traditionalApproach: {
    /** Total tokens with all tools exposed */
    totalTokens: number;
    /** Total number of tools exposed */
    totalTools: number;
  };
  /** Hierarchical routing metrics */
  hierarchicalApproach: {
    /** Total tokens (only 2 meta-tools) */
    totalTokens: number;
    /** Number of exposed tools (always 2) */
    exposedTools: number;
  };
  /** Savings calculations */
  savings: {
    /** Absolute token savings */
    tokens: number;
    /** Percentage savings */
    percent: number;
  };
  /** Scalability comparison */
  scalability: {
    /** Max tools with traditional approach */
    maxToolsTraditional: number;
    /** Max tools with hierarchical routing */
    maxToolsHierarchical: string;
  };
}

/**
 * Estimate token consumption for a single MCP tool
 *
 * @param tool - MCP tool definition
 * @returns Token estimate for the tool
 */
export function estimateToolTokens(tool: MCPTool): ToolTokenEstimate {
  // Convert tool to JSON Schema format (similar to OpenAI function calling)
  const toolJson = JSON.stringify({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema
  }, null, 2);

  const tokens = encode(toolJson);

  return {
    name: tool.name,
    tokens: tokens.length,
    description: tool.description?.slice(0, 100) || '',
    complexity: classifyToolComplexity(tokens.length)
  };
}

/**
 * Estimate token consumption for an entire MCP server
 *
 * @param mcpServer - MCP server configuration with tools
 * @returns Token consumption estimate for the server
 */
export function estimateMcpServerTokens(mcpServer: MCPServer): ServerTokenEstimate {
  if (!mcpServer.tools || mcpServer.tools.length === 0) {
    return {
      serverName: mcpServer.name,
      toolCount: 0,
      totalTokens: 0,
      averagePerTool: 0,
      minTokens: 0,
      maxTokens: 0,
      tools: [],
      complexity: 'simple'
    };
  }

  const toolEstimates = mcpServer.tools.map(tool => estimateToolTokens(tool));
  const totalTokens = toolEstimates.reduce((sum, est) => sum + est.tokens, 0);

  return {
    serverName: mcpServer.name,
    toolCount: mcpServer.tools.length,
    totalTokens,
    averagePerTool: Math.round(totalTokens / mcpServer.tools.length),
    minTokens: Math.min(...toolEstimates.map(t => t.tokens)),
    maxTokens: Math.max(...toolEstimates.map(t => t.tokens)),
    tools: toolEstimates,
    complexity: classifyServerComplexity(totalTokens, mcpServer.tools.length)
  };
}

/**
 * Analyze context window usage for multiple MCP servers
 *
 * @param mcpServers - Array of MCP server configurations
 * @param contextWindowSize - Total context window size (default: 200000 for Claude Sonnet 4.5)
 * @returns Context window usage analysis
 */
export function analyzeContextWindowUsage(
  mcpServers: MCPServer[],
  contextWindowSize: number = 200000
): ContextWindowAnalysis {
  const serverEstimates = mcpServers.map(server => estimateMcpServerTokens(server));

  const totalTools = serverEstimates.reduce((sum, est) => sum + est.toolCount, 0);
  const totalTokens = serverEstimates.reduce((sum, est) => sum + est.totalTokens, 0);
  const utilizationPercent = (totalTokens / contextWindowSize) * 100;
  const remainingTokens = contextWindowSize - totalTokens;

  return {
    contextWindowSize,
    totalServers: mcpServers.length,
    totalTools,
    totalTokens,
    utilizationPercent: parseFloat(utilizationPercent.toFixed(2)),
    remainingTokens,
    serversBreakdown: serverEstimates,
    recommendation: getRecommendation(utilizationPercent)
  };
}

/**
 * Calculate token savings from hierarchical routing
 *
 * DeployStack's hierarchical router exposes only 2 meta-tools instead of all tools:
 * - discover_mcp_tools: Natural language search for tools
 * - execute_mcp_tool: Execute a specific tool by path
 *
 * @param mcpServers - Array of MCP servers
 * @returns Savings analysis comparing traditional vs hierarchical approach
 */
export function calculateHierarchicalSavings(mcpServers: MCPServer[]): HierarchicalSavings {
  const analysis = analyzeContextWindowUsage(mcpServers);

  // Hierarchical routing exposes only 2 meta-tools:
  // - discover_mcp_tools (natural language search)
  // - execute_mcp_tool (execute specific tool)
  const hierarchicalTokens = 350; // Approximate for 2 meta-tools

  const tokenSavings = analysis.totalTokens - hierarchicalTokens;
  const savingsPercent = ((tokenSavings / analysis.totalTokens) * 100);

  return {
    traditionalApproach: {
      totalTokens: analysis.totalTokens,
      totalTools: analysis.totalTools
    },
    hierarchicalApproach: {
      totalTokens: hierarchicalTokens,
      exposedTools: 2 // discover and execute
    },
    savings: {
      tokens: tokenSavings,
      percent: parseFloat(savingsPercent.toFixed(2))
    },
    scalability: {
      maxToolsTraditional: Math.floor(200000 / (analysis.totalTokens / analysis.totalTools)),
      maxToolsHierarchical: 'unlimited (discovery-based)'
    }
  };
}

/**
 * Generate human-readable summary report for an MCP server
 *
 * @param mcpServer - MCP server configuration
 * @returns Formatted summary string
 */
export function generateServerSummary(mcpServer: MCPServer): string {
  const estimate = estimateMcpServerTokens(mcpServer);

  return `
MCP Server: ${estimate.serverName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tools: ${estimate.toolCount}
Total tokens: ${estimate.totalTokens.toLocaleString()}
Average per tool: ${estimate.averagePerTool} tokens
Range: ${estimate.minTokens} - ${estimate.maxTokens} tokens
Complexity: ${estimate.complexity}

Tool Breakdown:
${estimate.tools.map(t =>
  `  • ${t.name.padEnd(30)} ${t.tokens.toString().padStart(4)} tokens [${t.complexity}]`
).join('\n')}
`;
}

/**
 * Classify tool complexity based on token count
 *
 * @param tokenCount - Number of tokens
 * @returns Complexity classification
 */
function classifyToolComplexity(tokenCount: number): 'simple' | 'medium' | 'complex' | 'very-complex' {
  if (tokenCount < 100) return 'simple';
  if (tokenCount < 300) return 'medium';
  if (tokenCount < 600) return 'complex';
  return 'very-complex';
}

/**
 * Classify server complexity based on total tokens and tool count
 *
 * @param totalTokens - Total token count
 * @param toolCount - Number of tools
 * @returns Complexity classification
 */
function classifyServerComplexity(
  totalTokens: number,
  toolCount: number
): 'simple' | 'medium' | 'complex' | 'very-complex' {
  const avgPerTool = totalTokens / toolCount;

  if (totalTokens < 5000 && avgPerTool < 200) return 'simple';
  if (totalTokens < 15000 && avgPerTool < 400) return 'medium';
  if (totalTokens < 40000 && avgPerTool < 800) return 'complex';
  return 'very-complex';
}

/**
 * Get recommendation based on context window utilization
 *
 * @param utilizationPercent - Percentage of context window used
 * @returns Recommendation string
 */
function getRecommendation(utilizationPercent: number): string {
  if (utilizationPercent < 20) {
    return 'Excellent: Low context window usage, room for many more tools';
  }
  if (utilizationPercent < 40) {
    return 'Good: Moderate usage, can add more tools';
  }
  if (utilizationPercent < 60) {
    return 'Caution: Approaching high usage, consider hierarchical routing';
  }
  if (utilizationPercent < 80) {
    return 'Warning: High usage, implement hierarchical routing recommended';
  }
  return 'Critical: Very high usage, hierarchical routing required';
}

/**
 * Default export with all functions
 */
export default {
  estimateMcpServerTokens,
  estimateToolTokens,
  analyzeContextWindowUsage,
  calculateHierarchicalSavings,
  generateServerSummary
};
