/**
 * TypeScript interfaces for MCP Tools Token Statistics
 */

export interface ToolStats {
  tool_name: string
  token_count: number
}

export interface InstallationStats {
  installation_id: string
  installation_name: string
  server_slug: string
  server_name: string
  tool_count: number
  total_tokens: number
  average_tokens_per_tool: number
  tools: ToolStats[]
}

export interface TraditionalApproach {
  total_tools: number
  total_tokens: number
  context_window_utilization_percent: number
}

export interface HierarchicalApproach {
  exposed_tools: number
  total_tokens: number
  context_window_utilization_percent: number
}

export interface TokenSavings {
  tokens_saved: number
  reduction_percent: number
}

export interface TeamMcpToolsStats {
  team_id: string
  context_window_size: number
  total_installations: number
  total_tools: number
  total_tokens: number
  traditional_approach: TraditionalApproach
  hierarchical_approach: HierarchicalApproach
  savings: TokenSavings
  installations: InstallationStats[]
}

export interface TeamMcpToolsStatsResponse {
  success: boolean
  data: TeamMcpToolsStats
}
