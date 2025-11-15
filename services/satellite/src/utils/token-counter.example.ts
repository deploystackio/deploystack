/**
 * Token Counter Usage Examples
 *
 * This file demonstrates how to use the token-counter utility in the satellite service.
 * It shows real-world integration scenarios with tool discovery managers.
 */

import {
  estimateMcpServerTokens,
  analyzeContextWindowUsage,
  calculateHierarchicalSavings,
  MCPServer,
  MCPTool
} from './token-counter';

/**
 * Example 1: Estimate tokens for discovered tools
 *
 * After tool discovery from an MCP server, estimate token consumption
 */
export function exampleEstimateDiscoveredTools() {
  // Simulated discovered tools from UnifiedToolDiscoveryManager
  const discoveredTools: MCPTool[] = [
    {
      name: 'read_file',
      description: 'Read contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' }
        },
        required: ['path']
      }
    },
    {
      name: 'write_file',
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path' },
          content: { type: 'string', description: 'File content' }
        },
        required: ['path', 'content']
      }
    }
  ];

  const server: MCPServer = {
    name: 'filesystem-team-abc123',
    tools: discoveredTools
  };

  const estimate = estimateMcpServerTokens(server);

  console.log(`Server ${estimate.serverName}:`);
  console.log(`  Tools: ${estimate.toolCount}`);
  console.log(`  Total Tokens: ${estimate.totalTokens}`);
  console.log(`  Complexity: ${estimate.complexity}`);

  return estimate;
}

/**
 * Example 2: Analyze context window usage for multiple teams
 *
 * When multiple teams have different MCP servers installed, analyze total impact
 */
export function exampleAnalyzeMultipleTeams() {
  // Team 1: Developer tools
  const team1Server: MCPServer = {
    name: 'github-team1-xyz',
    tools: [
      {
        name: 'create_issue',
        description: 'Create GitHub issue',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['title']
        }
      }
    ]
  };

  // Team 2: Data tools
  const team2Server: MCPServer = {
    name: 'database-team2-abc',
    tools: [
      {
        name: 'query',
        description: 'Execute database query',
        inputSchema: {
          type: 'object',
          properties: {
            sql: { type: 'string', description: 'SQL query' }
          },
          required: ['sql']
        }
      }
    ]
  };

  // Analyze with default 200k context window (Claude Sonnet 4.5)
  const analysis = analyzeContextWindowUsage([team1Server, team2Server]);

  console.log(`Total servers: ${analysis.totalServers}`);
  console.log(`Total tools: ${analysis.totalTools}`);
  console.log(`Context usage: ${analysis.utilizationPercent}%`);
  console.log(`Recommendation: ${analysis.recommendation}`);

  return analysis;
}

/**
 * Example 3: Calculate hierarchical routing savings
 *
 * Show the benefit of DeployStack's hierarchical router pattern
 */
export function exampleCalculateHierarchicalSavings() {
  // Simulate a large deployment with many MCP servers
  const servers: MCPServer[] = [
    {
      name: 'filesystem',
      tools: Array.from({ length: 15 }, (_, i) => ({
        name: `tool_${i}`,
        description: `Filesystem operation ${i}`,
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        }
      }))
    },
    {
      name: 'github',
      tools: Array.from({ length: 20 }, (_, i) => ({
        name: `github_tool_${i}`,
        description: `GitHub operation ${i}`,
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string' }
          },
          required: ['repo']
        }
      }))
    }
  ];

  const savings = calculateHierarchicalSavings(servers);

  console.log('Traditional approach:');
  console.log(`  ${savings.traditionalApproach.totalTools} tools exposed`);
  console.log(`  ${savings.traditionalApproach.totalTokens} tokens`);
  console.log('\nHierarchical approach:');
  console.log(`  ${savings.hierarchicalApproach.exposedTools} meta-tools exposed`);
  console.log(`  ${savings.hierarchicalApproach.totalTokens} tokens`);
  console.log(`\nSavings: ${savings.savings.percent}% reduction`);

  return savings;
}

/**
 * Example 4: Integration with Tool Discovery Manager
 *
 * How to integrate token counting after tool discovery
 */
export async function exampleIntegrateWithToolDiscovery() {
  // This would be called after UnifiedToolDiscoveryManager.initialize()
  // and tools are cached

  // Pseudocode showing integration pattern:
  /*
  class UnifiedToolDiscoveryManager {
    async initialize(): Promise<void> {
      // ... existing discovery logic ...

      // After tools are discovered, optionally count tokens:
      const allTools = this.getAllTools(); // Get cached tools

      // Group tools by server for token counting
      const serverMap = new Map<string, MCPTool[]>();
      for (const tool of allTools) {
        const serverName = tool.serverName;
        if (!serverMap.has(serverName)) {
          serverMap.set(serverName, []);
        }
        serverMap.get(serverName)!.push({
          name: tool.originalName,
          description: tool.description,
          inputSchema: tool.inputSchema
        });
      }

      // Create MCPServer objects for each server
      const mcpServers: MCPServer[] = Array.from(serverMap.entries()).map(
        ([name, tools]) => ({ name, tools })
      );

      // Analyze token usage
      const analysis = analyzeContextWindowUsage(mcpServers);

      this.logger.info({
        operation: 'tool_discovery_token_analysis',
        totalTools: analysis.totalTools,
        totalTokens: analysis.totalTokens,
        utilization: analysis.utilizationPercent,
        recommendation: analysis.recommendation
      }, 'Token usage analysis completed');
    }
  }
  */

  console.log('See comments above for integration pattern');
}

/**
 * Example 5: Custom context window for different models
 */
export function exampleCustomContextWindow() {
  const server: MCPServer = {
    name: 'example-server',
    tools: [
      {
        name: 'example_tool',
        description: 'Example tool',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }
    ]
  };

  // For Claude Sonnet 4.5 (200k)
  const claudeAnalysis = analyzeContextWindowUsage([server], 200000);
  console.log(`Claude Sonnet 4.5: ${claudeAnalysis.utilizationPercent}%`);

  // For GPT-4 (128k)
  const gpt4Analysis = analyzeContextWindowUsage([server], 128000);
  console.log(`GPT-4: ${gpt4Analysis.utilizationPercent}%`);

  // For Gemini 2.0 (1M)
  const geminiAnalysis = analyzeContextWindowUsage([server], 1000000);
  console.log(`Gemini 2.0: ${geminiAnalysis.utilizationPercent}%`);
}
