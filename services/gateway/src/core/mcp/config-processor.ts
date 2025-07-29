import { MCPInstallation, MCPServerConfig, TeamMCPConfig } from '../../types/mcp';

/**
 * Process MCP installations into server configurations for the Gateway
 * @param teamId Team ID
 * @param teamName Team name
 * @param installations Raw MCP installations from API
 * @returns Processed team MCP configuration
 */
export function processMCPInstallations(
  teamId: string,
  teamName: string,
  installations: MCPInstallation[]
): TeamMCPConfig {
  const servers: MCPServerConfig[] = installations.map(installation => {
    // Process installation methods to extract command and args
    const installationMethods = installation.server.installation_methods || [];
    let command = 'npx';
    let args: string[] = [];


    // Find the claude-desktop installation method
    const claudeDesktopMethod = installationMethods.find(
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (method: any) => method.client === 'claude-desktop'
    );

    if (claudeDesktopMethod) {
      // Use the installation method data directly
      command = claudeDesktopMethod.command || 'npx';
      args = claudeDesktopMethod.args || [];
    } else {
      // Fallback logic for servers without proper installation_methods
      const runtime = installation.server.runtime;
      
      if (runtime === 'node' || runtime === 'nodejs') {
        command = 'npx';
        args = [installation.server.name];
      } else if (runtime === 'python') {
        command = 'python';
        args = ['-m', installation.server.name];
      } else if (runtime === 'go') {
        command = installation.server.name;
        args = [];
      } else {
        // Final fallback
        command = 'npx';
        args = [installation.server.name];
      }
    }

    // Merge environment variables from server definition and user customization
    const serverEnvVars = installation.server.environment_variables || [];
    const env: Record<string, string> = {};

    // Add server-defined environment variables (if they have default values)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serverEnvVars.forEach((envVar: any) => {
      if (envVar.name && envVar.default_value) {
        env[envVar.name] = envVar.default_value;
      }
    });

    // Override with user-provided environment variables
    Object.assign(env, installation.user_environment_variables || {});

    return {
      id: installation.id,
      name: installation.server.name,
      installation_name: installation.installation_name,
      command,
      args,
      env,
      runtime: installation.server.runtime,
      installation_type: installation.installation_type
    };
  });

  return {
    team_id: teamId,
    team_name: teamName,
    installations,
    servers,
    last_updated: new Date().toISOString()
  };
}

/**
 * Validate that an MCP installation has required fields
 * @param installation MCP installation to validate
 * @returns true if valid
 */
export function validateMCPInstallation(installation: MCPInstallation): boolean {
  if (!installation.id || !installation.server_id || !installation.installation_name) {
    return false;
  }

  if (!installation.server || !installation.server.name || !installation.server.runtime) {
    return false;
  }

  return true;
}

/**
 * Filter and validate MCP installations
 * @param installations Raw installations from API
 * @returns Valid installations only
 */
export function filterValidInstallations(installations: MCPInstallation[]): MCPInstallation[] {
  return installations.filter(validateMCPInstallation);
}
