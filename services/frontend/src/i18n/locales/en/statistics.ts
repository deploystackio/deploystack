export default {
  title: 'Statistics',
  description: 'MCP tools token usage and context window optimization metrics',

  errors: {
    noTeamSelected: 'No team selected. Please select a team to view statistics.',
    fetchFailed: 'Failed to fetch statistics. Please try again.',
  },

  emptyState: {
    title: 'No MCP Installations',
    description: 'Install MCP servers to see token usage statistics and savings.',
  },

  cards: {
    installations: 'MCP Installations',
    mcpServers: 'MCP servers installed',
    totalTools: 'Total Tools',
    availableTools: 'tools available',
    tokenSavings: 'Token Savings',
    saved: 'saved',
    hierarchicalUsage: 'DeployStack Usage',
    ofContext: 'of context window',
    of: 'of',
    tokens: 'tokens',
  },

  comparison: {
    title: 'Traditional vs Hierarchical Routing',
    description: 'Compare token consumption between exposing all tools directly and using DeployStack\'s hierarchical routing system.',
    traditional: 'Traditional Approach',
    hierarchical: 'Hierarchical Routing',
    deploystack: 'DeployStack',
    totalTools: 'Total tools exposed',
    metaTools: 'Meta-tools exposed',
    tokens: 'Token consumption',
    contextUsage: 'Context window usage',
  },

  breakdown: {
    title: 'Token Usage Comparison',
    description: 'Left: Traditional approach with all MCP tools stacked. Right: DeployStack routing with constant 2 meta-tools.',
  },

  installations: {
    title: 'Installation Breakdown',
    description: 'Detailed token usage by MCP server installation. Click rows to expand and see individual tool statistics.',
    columns: {
      name: 'Installation Name',
      tools: 'Tools',
      tokens: 'Total Tokens',
      avgPerTool: 'Avg per Tool',
    },
  },

  underConstruction: {
    title: 'Under Construction',
    description: 'This page is currently being built',
    message: 'Statistics and analytics features are coming soon. Check back later for insights into your MCP server usage, team activity, and more.',
  },
}
