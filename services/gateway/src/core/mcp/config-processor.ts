import { MCPInstallation, MCPServerConfig, TeamMCPConfig, MCPUserConfiguration } from '../../types/mcp';

/**
 * Process MCP installations into server configurations for the Gateway (Three-tier architecture)
 * @param teamId Team ID
 * @param teamName Team name
 * @param installations Raw MCP installations from API
 * @param userConfigurations User configurations from API
 * @returns Processed team MCP configuration
 */
export function processMCPInstallations(
  teamId: string,
  teamName: string,
  installations: MCPInstallation[],
  userConfigurations: MCPUserConfiguration[] = []
): TeamMCPConfig {
  const servers: MCPServerConfig[] = installations.map(installation => {
    // Process installation methods to extract template command and args
    const installationMethods = installation.server.installation_methods || [];
    let templateCommand = 'npx';
    let templateArgs: string[] = [];

    // Find the claude-desktop installation method for template args
    const claudeDesktopMethod = installationMethods.find(
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      (method: any) => method.client === 'claude-desktop'
    );

    if (claudeDesktopMethod) {
      // Use the installation method data directly
      templateCommand = claudeDesktopMethod.command || 'npx';
      templateArgs = claudeDesktopMethod.args || [];
    } else {
      // Fallback logic for servers without proper installation_methods
      const runtime = installation.server.runtime;
      
      if (runtime === 'node' || runtime === 'nodejs') {
        templateCommand = 'npx';
        templateArgs = [installation.server.name];
      } else if (runtime === 'python') {
        templateCommand = 'python';
        templateArgs = ['-m', installation.server.name];
      } else if (runtime === 'go') {
        templateCommand = installation.server.name;
        templateArgs = [];
      } else {
        // Final fallback
        templateCommand = 'npx';
        templateArgs = [installation.server.name];
      }
    }

    // Find user configuration for this installation (use first one for now)
    const userConfig = userConfigurations.find(config => config.installation_id === installation.id);

    // Three-tier assembly: Template + Team + User
    const finalArgs = [
      ...templateArgs,                           // Template args (fixed)
      ...(installation.team_args || []),        // Team args (shared)
      ...(userConfig?.user_args || [])          // User args (personal)
    ];

    // Three-tier environment assembly: Template + Team + User
    const serverEnvVars = installation.server.environment_variables || [];
    const env: Record<string, string> = {};

    // Add server-defined environment variables (template level)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serverEnvVars.forEach((envVar: any) => {
      if (envVar.name && envVar.default_value) {
        env[envVar.name] = envVar.default_value;
      }
    });

    // Add team-level environment variables
    Object.assign(env, installation.team_env || {});

    // Add user-level environment variables
    Object.assign(env, userConfig?.user_env || {});

    return {
      id: installation.id,
      name: installation.server.name,
      installation_name: installation.installation_name,
      command: templateCommand,
      args: finalArgs,
      env,
      runtime: installation.server.runtime,
      installation_type: installation.installation_type,
      transport_type: installation.server.transport_type
    };
  });

  return {
    team_id: teamId,
    team_name: teamName,
    installations,
    user_configurations: userConfigurations,
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
