// Re-export types from the main types file
export type {
  McpServer,
  McpInstallation,
  InstallServerRequest,
  EnvironmentVariable
} from '@/types/mcp-installations'

// View-specific types for MCP server management
// Add future types here as the MCP server views expand

// Example: Future types for MCP server management views
// export interface McpServerManageFormData {
//   installation_name: string
//   environment_variables: Record<string, string>
//   auto_restart: boolean
// }

// export interface McpServerConfigurationState {
//   isEditing: boolean
//   hasUnsavedChanges: boolean
//   validationErrors: Record<string, string>
// }
