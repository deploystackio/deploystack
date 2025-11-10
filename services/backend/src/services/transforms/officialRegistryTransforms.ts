/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Official MCP Registry Data Transformation Layer
 * 
 * Transforms official MCP Registry format to DeployStack's internal format
 * Reuses existing ConfigurationSchema types from schemas.ts
 */

import type { FastifyBaseLogger } from 'fastify';
import type {
  ConfigurationSchema,
  TemplateArg,
  TemplateEnv,
  TemplateHeader,
  TemplateUrlQueryParam,
  TeamArg,
  TeamEnv,
  TeamHeader,
  TeamUrlQueryParam,
  UserArg,
  UserEnv,
  UserHeader,
  UserUrlQueryParam,
  CreateGlobalServerRequest
} from '../../routes/mcp/servers/schemas';
import { GitHubService } from '../githubService';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert empty strings to undefined for optional fields
 * Official registry sometimes returns empty strings instead of omitting fields
 * 
 * @param value - Value to check and convert
 * @returns undefined if value is empty string, otherwise the original value
 */
function emptyToUndefined(value: string | undefined): string | undefined {
  return value === '' ? undefined : value;
}

// =============================================================================
// OFFICIAL REGISTRY TYPE DEFINITIONS
// =============================================================================

/**
 * Official Registry Environment Variable
 * Source: registry.modelcontextprotocol.io schema
 */
export interface OfficialEnvironmentVariable {
  name: string;
  description?: string;
  isRequired?: boolean;
  format?: string;
  value?: string;
  isSecret?: boolean;
  default?: string;
  choices?: string[];
}

/**
 * Official Registry Transport Type
 */
export interface OfficialTransport {
  type: 'stdio' | 'streamable-http' | 'sse';
  command?: string; // Optional in official registry
  args?: string[]; // Optional in official registry
}

/**
 * Official Registry Package (npm, pypi, docker, etc.)
 */
export interface OfficialPackage {
  registryType: string;
  registryBaseUrl?: string;
  identifier: string;
  version: string;
  transport: OfficialTransport;
  environmentVariables?: OfficialEnvironmentVariable[];
  runtimeArguments?: any[];
  packageArguments?: any[];
}

/**
 * Official Registry Header (for HTTP/SSE remotes)
 */
export interface OfficialHeader {
  name: string;
  description?: string;
  isRequired?: boolean;
  isSecret?: boolean;
  value?: string;
  default?: string;
}

/**
 * Official Registry Remote (HTTP/SSE endpoints)
 */
export interface OfficialRemote {
  type: 'streamable-http' | 'sse';
  url: string;
  headers?: OfficialHeader[];
}

/**
 * Official Registry Repository Information
 */
export interface OfficialRepository {
  url: string;
  source: string;
  id?: string;
  subfolder?: string;
}

/**
 * Official MCP Registry Server
 * Complete server definition from registry.modelcontextprotocol.io
 */
export interface OfficialServer {
  $schema?: string;
  name: string; // Official reverse-DNS name (e.g., "io.github.upstash/context7")
  description: string;
  status?: 'active' | 'deprecated' | 'deleted';
  version: string;
  repository?: OfficialRepository;
  websiteUrl?: string;
  packages?: OfficialPackage[];
  remotes?: OfficialRemote[];
  _meta?: Record<string, any>;
}

// =============================================================================
// NAME TRANSFORMATION UTILITIES
// =============================================================================

/**
 * Transform official reverse-DNS name to user-friendly display name
 * 
 * Examples:
 * - "io.github.upstash/context7" → "Context7"
 * - "io.github.vfarcic/dot-ai" → "Dot AI"
 * - "com.apple-rag/mcp-server" → "Apple RAG"
 * - "ai.tickettailor/mcp" → "Tickettailor" (fallback to domain when server part becomes empty)
 * 
 * @param officialName - Official reverse-DNS name
 * @returns User-friendly display name
 */
export function createFriendlyName(officialName: string): string {
  // Extract the server part after the last slash
  const parts = officialName.split('/');
  const serverPart = parts[parts.length - 1] || officialName;
  const domainPart = parts.length > 1 ? parts[0] : '';
  
  // Remove common prefixes
  let friendlyName = serverPart
    .replace(/^mcp-server-?/i, '')
    .replace(/^mcp-?/i, '')
    .replace(/-server$/i, '')
    .replace(/-mcp$/i, '');
  
  // If friendly name is empty after removing prefixes, use domain part
  if (!friendlyName || friendlyName.trim() === '') {
    // Extract company/service name from domain (e.g., "ai.tickettailor" → "tickettailor")
    const domainParts = domainPart.split('.');
    friendlyName = domainParts[domainParts.length - 1] || officialName;
  }
  
  // Convert kebab-case and snake_case to Title Case
  friendlyName = friendlyName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  
  // Handle special cases
  const specialCases: Record<string, string> = {
    'dot-ai': 'Dot AI',
    'context7': 'Context7',
    'apple-rag': 'Apple RAG',
    'brave-search': 'Brave Search',
  };
  
  const lowerKey = serverPart.toLowerCase();
  if (specialCases[lowerKey]) {
    return specialCases[lowerKey];
  }
  
  return friendlyName;
}

/**
 * Create URL-friendly slug from official name
 * 
 * @param officialName - Official reverse-DNS name
 * @returns URL-friendly slug
 */
export function createSlug(officialName: string): string {
  return officialName
    .replace(/^[^/]+\//, '') // Remove namespace prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// =============================================================================
// TRANSPORT TYPE DERIVATION
// =============================================================================

/**
 * Infer command and args for STDIO packages based on registry type
 * 
 * The official MCP registry doesn't always provide command/args in the transport object.
 * We need to infer them based on the package's registryType and identifier.
 * 
 * @param pkg - Official package data
 * @returns Inferred transport with command and args
 */
export function inferStdioTransport(pkg: OfficialPackage): {
  command: string;
  args: string[];
} {
  // If transport already has command and args, use them
  if (pkg.transport.command && pkg.transport.args) {
    return {
      command: pkg.transport.command,
      args: pkg.transport.args
    };
  }
  
  // Otherwise, infer based on registryType
  const identifier = pkg.identifier;
  
  switch (pkg.registryType.toLowerCase()) {
    case 'npm':
      // NPM packages: npx -y <package-name>
      return {
        command: 'npx',
        args: ['-y', identifier]
      };
    
    case 'pypi':
      // PyPI packages: uvx <package-name>
      // Alternative: python -m <package-name>
      return {
        command: 'uvx',
        args: [identifier]
      };
    
    case 'docker':
      // Docker images: docker run <image-name>
      return {
        command: 'docker',
        args: ['run', identifier]
      };
    
    default:
      // Fallback to npx for unknown types
      return {
        command: 'npx',
        args: [identifier]
      };
  }
}

/**
 * Derive DeployStack transport_type from official packages/remotes
 * 
 * @param packages - Official packages array
 * @param remotes - Official remotes array
 * @returns DeployStack transport type
 */
export function deriveTransportType(
  packages?: OfficialPackage[],
  remotes?: OfficialRemote[]
): 'stdio' | 'http' | 'sse' {
  // Check packages first
  if (packages && packages.length > 0) {
    const transport = packages[0].transport?.type;
    if (transport === 'stdio') return 'stdio';
    if (transport === 'streamable-http') return 'http';
    if (transport === 'sse') return 'sse';
  }
  
  // Check remotes
  if (remotes && remotes.length > 0) {
    const transport = remotes[0].type;
    if (transport === 'streamable-http') return 'http';
    if (transport === 'sse') return 'sse';
  }
  
  return 'stdio'; // Default fallback
}

/**
 * Derive programming language from packages
 * 
 * @param packages - Official packages array
 * @returns Programming language identifier
 */
export function deriveLanguage(packages?: OfficialPackage[]): string {
  if (!packages || packages.length === 0) return 'http';
  
  const registryType = packages[0].registryType;
  switch (registryType) {
    case 'npm': return 'typescript';
    case 'pypi': return 'python';
    case 'docker': return 'docker';
    default: return 'http';
  }
}

/**
 * Derive runtime from packages
 * 
 * @param packages - Official packages array
 * @returns Runtime identifier
 */
export function deriveRuntime(packages?: OfficialPackage[]): string {
  if (!packages || packages.length === 0) return 'http';
  
  const registryType = packages[0].registryType;
  switch (registryType) {
    case 'npm': return 'node';
    case 'pypi': return 'python';
    case 'docker': return 'docker';
    default: return 'http';
  }
}

// =============================================================================
// THREE-TIER CONFIGURATION MAPPING
// =============================================================================

/**
 * Map official environment variables to DeployStack's 3-tier configuration system
 * 
 * Rules:
 * - Fixed values → Template Level (locked)
 * - Secrets & required → Team Level (shared credentials)
 * - Optional configs → User Level (personal customization)
 * 
 * @param envVars - Official environment variables array
 * @returns DeployStack ConfigurationSchema with template/team/user tiers
 */
export function mapEnvironmentVariablesToThreeTier(
  envVars: OfficialEnvironmentVariable[]
): Pick<ConfigurationSchema, 'template_env' | 'team_env_schema' | 'user_env_schema'> {
  const templateEnv: TemplateEnv[] = [];
  const teamEnvSchema: TeamEnv[] = [];
  const userEnvSchema: UserEnv[] = [];
  
  for (const envVar of envVars) {
    // Fixed values go to Template Level (locked)
    if (envVar.value && envVar.value !== 'YOUR_API_KEY' && envVar.value !== 'TOKEN') {
      templateEnv.push({
        name: envVar.name,
        value: envVar.value,
        locked: true,
        description: envVar.description || `Fixed value: ${envVar.value}`,
        type: 'string',
        required: true
      });
      continue;
    }
    
    // Secrets and required vars go to Team Level (shared credentials)
    if (envVar.isSecret || envVar.isRequired) {
      teamEnvSchema.push({
        name: envVar.name,
        type: envVar.isSecret ? 'secret' : (envVar.format as any || 'string'),
        required: envVar.isRequired || false,
        description: envVar.description || `Environment variable: ${envVar.name}`,
        locked: false,
        default_team_locked: envVar.isSecret || false, // Secrets locked by default
        visible_to_users: !envVar.isSecret, // Secrets not visible to users
      });
      continue;
    }
    
    // Optional configs go to User Level (personal customization)
    userEnvSchema.push({
      name: envVar.name,
      type: (envVar.format as any || 'string'),
      required: false,
      description: envVar.description || `Optional environment variable: ${envVar.name}`,
      locked: false,
      // No default value or choices in existing schema, but keeping for consistency
    });
  }
  
  return { template_env: templateEnv, team_env_schema: teamEnvSchema, user_env_schema: userEnvSchema };
}

/**
 * Map official headers to DeployStack's 3-tier header system
 * 
 * Rules:
 * - ALL headers from remotes → Team Level (shared credentials)
 * - Secret headers marked with type: 'secret' and appropriate visibility
 * 
 * @param headers - Official headers array
 * @returns DeployStack ConfigurationSchema header configuration
 */
export function mapHeadersToThreeTier(
  headers: OfficialHeader[]
): Pick<ConfigurationSchema, 'template_headers' | 'team_headers_schema' | 'user_headers_schema'> {
  const templateHeaders: TemplateHeader[] = [];
  const teamHeadersSchema: TeamHeader[] = [];
  const userHeadersSchema: UserHeader[] = [];
  
  // ALL headers from remotes go to team level
  for (const header of headers) {
    teamHeadersSchema.push({
      name: header.name,
      type: header.isSecret ? 'secret' : 'string',
      required: header.isRequired || false,
      description: header.description || `Header: ${header.name}`,
      locked: false,
      default_team_locked: false,
      visible_to_users: !header.isSecret,
    });
  }
  
  return { template_headers: templateHeaders, team_headers_schema: teamHeadersSchema, user_headers_schema: userHeadersSchema };
}

/**
 * Map URL query parameters to DeployStack's 3-tier configuration system
 *
 * Parses URLs from remotes to extract query parameters and categorizes them:
 * - Fixed literal values → Template Level (locked)
 * - Template variables like {API_KEY} → Team Level (secrets/required)
 * - Optional parameters → User Level (customizable)
 *
 * @param remotes - Official remotes array (HTTP/SSE only)
 * @returns DeployStack ConfigurationSchema URL query param configuration + cleaned base URL
 */
export function mapUrlQueryParamsToThreeTier(
  remotes?: OfficialRemote[]
): {
  baseUrl: string | null;
  template_url_query_params: TemplateUrlQueryParam[];
  team_url_query_params_schema: TeamUrlQueryParam[];
  user_url_query_params_schema: UserUrlQueryParam[];
} {
  const templateUrlQueryParams: TemplateUrlQueryParam[] = [];
  const teamUrlQueryParamsSchema: TeamUrlQueryParam[] = [];
  const userUrlQueryParamsSchema: UserUrlQueryParam[] = [];

  // Only process if we have remotes (HTTP/SSE transports)
  if (!remotes || remotes.length === 0) {
    return {
      baseUrl: null,
      template_url_query_params: templateUrlQueryParams,
      team_url_query_params_schema: teamUrlQueryParamsSchema,
      user_url_query_params_schema: userUrlQueryParamsSchema
    };
  }

  // Parse URL from first remote
  const urlString = remotes[0].url;
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(urlString);
  } catch {
    // Invalid URL - return empty arrays with original URL
    return {
      baseUrl: urlString,
      template_url_query_params: templateUrlQueryParams,
      team_url_query_params_schema: teamUrlQueryParamsSchema,
      user_url_query_params_schema: userUrlQueryParamsSchema
    };
  }

  // Extract base URL without query params
  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;

  // Parse query parameters
  const queryParams = parsedUrl.searchParams;

  // Pattern to detect template variables: {VARIABLE_NAME}
  const templateVariablePattern = /^\{([A-Z_][A-Z0-9_]*)\}$/;

  for (const [paramName, paramValue] of queryParams.entries()) {
    // Check if value is a template variable
    const templateMatch = paramValue.match(templateVariablePattern);

    if (templateMatch) {
      // Template variable like {API_KEY} → Team Level
      const variableName = templateMatch[1];

      // Detect if it's a secret based on name patterns
      const secretPatterns = /^(.*_)?(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)(_.*)?$/i;
      const isSecret = secretPatterns.test(variableName);

      teamUrlQueryParamsSchema.push({
        name: paramName,
        type: isSecret ? 'secret' : 'string',
        required: true, // Template variables are typically required
        description: `${paramName} (from template variable: ${variableName})`,
        locked: false,
        default_team_locked: isSecret, // Lock secrets at team level
        visible_to_users: !isSecret, // Hide secrets from users
      });
    } else if (paramValue && paramValue.trim() !== '') {
      // Fixed literal value → Template Level (locked)
      templateUrlQueryParams.push({
        name: paramName,
        value: paramValue,
        locked: true,
        description: `Fixed query parameter: ${paramName}=${paramValue}`,
        type: 'string',
        required: true
      });
    } else {
      // Empty or optional parameter → User Level
      userUrlQueryParamsSchema.push({
        name: paramName,
        type: 'string',
        required: false,
        description: `Optional query parameter: ${paramName}`,
        locked: false,
      });
    }
  }

  return {
    baseUrl,
    template_url_query_params: templateUrlQueryParams,
    team_url_query_params_schema: teamUrlQueryParamsSchema,
    user_url_query_params_schema: userUrlQueryParamsSchema
  };
}

/**
 * Map official runtime/package arguments to DeployStack's 3-tier args system
 * 
 * IMPORTANT: For STDIO packages, we need to infer command/args if not provided
 * 
 * @param packages - Official packages array
 * @returns DeployStack ConfigurationSchema args configuration
 */
export function mapArgumentsToThreeTier(
  packages?: OfficialPackage[]
): Pick<ConfigurationSchema, 'template_args' | 'team_args_schema' | 'user_args_schema'> {
  const templateArgs: TemplateArg[] = [];
  const teamArgsSchema: TeamArg[] = [];
  const userArgsSchema: UserArg[] = [];
  
  if (!packages || packages.length === 0) {
    return { template_args: templateArgs, team_args_schema: teamArgsSchema, user_args_schema: userArgsSchema };
  }
  
  // Extract runtime and package arguments
  const pkg = packages[0];
  
  // For STDIO packages, infer transport command/args if not provided
  if (pkg.transport.type === 'stdio') {
    const inferredTransport = inferStdioTransport(pkg);
    
    // Add inferred args as template args (locked)
    for (const arg of inferredTransport.args) {
      templateArgs.push({
        value: arg,
        locked: true,
        description: `Static argument: ${arg}`
      });
    }
    
    // Store command in the package for later use
    // This will be used when constructing the packages array
    if (!pkg.transport.command) {
      pkg.transport.command = inferredTransport.command;
    }
    if (!pkg.transport.args) {
      pkg.transport.args = inferredTransport.args;
    }
  }
  
  // Package arguments go to template (locked)
  if (pkg.packageArguments && pkg.packageArguments.length > 0) {
    for (const arg of pkg.packageArguments) {
      templateArgs.push({
        value: String(arg),
        locked: true,
        description: 'Package argument'
      });
    }
  }
  
  // Runtime arguments might be configurable at team/user level
  if (pkg.runtimeArguments && pkg.runtimeArguments.length > 0) {
    // For now, treat runtime arguments as user-configurable
    userArgsSchema.push({
      name: 'runtime_args',
      type: 'string',
      required: false,
      description: 'Runtime arguments',
      locked: false,
      min_items: 0,
      max_items: 10
    });
  }
  
  return { template_args: templateArgs, team_args_schema: teamArgsSchema, user_args_schema: userArgsSchema };
}

// =============================================================================
// MAIN TRANSFORMATION FUNCTION
// =============================================================================

/**
 * Transform official registry server to DeployStack format
 * 
 * Outputs data in the exact format that create-global.ts expects
 * Reuses existing ConfigurationSchema types from schemas.ts
 * 
 * @param officialServer - Official MCP Registry server data
 * @param _createdBy - User ID creating the server (unused in transformation, used by caller)
 * @param options - Optional transformation options
 * @param options.logger - Logger for GitHub API calls
 * @param options.fetchGitHubMetadata - Enable GitHub metadata enhancement (default: false)
 * @returns Partial CreateGlobalServerRequest ready for McpCatalogService.createServer
 */
export async function transformOfficialToDeployStack(
  officialServer: OfficialServer,
  _createdBy: string,
  options?: {
    logger?: FastifyBaseLogger;
    fetchGitHubMetadata?: boolean;
  }
): Promise<Partial<CreateGlobalServerRequest>> {
  // IMPORTANT: Create a deep copy of packages to avoid mutating the original
  // We'll be adding inferred command/args to the packages during transformation
  const packagesCopy = officialServer.packages ? JSON.parse(JSON.stringify(officialServer.packages)) : undefined;
  
  // Extract 3-tier configurations from packages (env vars + args)
  const envConfig = mapEnvironmentVariablesToThreeTier(
    packagesCopy?.[0]?.environmentVariables || []
  );
  
  // This will infer and add command/args to packagesCopy if missing
  const argsConfig = mapArgumentsToThreeTier(packagesCopy);
  
  // Extract 3-tier configurations from remotes (headers)
  // Merge headers from all remotes (in case there are multiple endpoints)
  const allHeaders: OfficialHeader[] = [];
  if (officialServer.remotes && officialServer.remotes.length > 0) {
    for (const remote of officialServer.remotes) {
      if (remote.headers && remote.headers.length > 0) {
        allHeaders.push(...remote.headers);
      }
    }
  }
  const headerConfig = mapHeadersToThreeTier(allHeaders);

  // Extract 3-tier configurations from URL query parameters
  const urlQueryParamConfig = mapUrlQueryParamsToThreeTier(officialServer.remotes);

  // Clean remotes array - replace URLs with base URLs (without query params)
  let cleanedRemotes = officialServer.remotes;
  if (officialServer.remotes && officialServer.remotes.length > 0 && urlQueryParamConfig.baseUrl) {
    cleanedRemotes = officialServer.remotes.map((remote, index) => {
      // Only clean the first remote URL (where we extracted query params from)
      if (index === 0) {
        return {
          ...remote,
          url: urlQueryParamConfig.baseUrl as string
        };
      }
      return remote;
    });
  }

  // Combine into full ConfigurationSchema
  const configurationSchema: ConfigurationSchema = {
    template_args: argsConfig.template_args,
    template_env: envConfig.template_env,
    template_headers: headerConfig.template_headers,
    template_url_query_params: urlQueryParamConfig.template_url_query_params,
    team_args_schema: argsConfig.team_args_schema,
    team_env_schema: envConfig.team_env_schema,
    team_headers_schema: headerConfig.team_headers_schema,
    team_url_query_params_schema: urlQueryParamConfig.team_url_query_params_schema,
    user_args_schema: argsConfig.user_args_schema,
    user_env_schema: envConfig.user_env_schema,
    user_headers_schema: headerConfig.user_headers_schema,
    user_url_query_params_schema: urlQueryParamConfig.user_url_query_params_schema,
  };
  
  // Create friendly name (slug auto-generated by McpCatalogService)
  const friendlyName = createFriendlyName(officialServer.name);
  
  // Extract repository info
  const repository = officialServer.repository;
  
  // Derive DeployStack fields
  const transportType = deriveTransportType(officialServer.packages, officialServer.remotes);
  const language = deriveLanguage(officialServer.packages);
  const runtime = deriveRuntime(officialServer.packages);
  
  // Build base server data in create-global.ts format
  // Note: status field not included as it's not part of CreateGlobalServerRequest
  // Status will be set to 'active' by default in the service layer
  const baseData: Partial<CreateGlobalServerRequest> = {
    name: friendlyName,
    description: officialServer.description,
    language: language,
    runtime: runtime,
    
    // Version information
    version: officialServer.version,
    
    // Repository information - convert empty strings to undefined
    repository_url: emptyToUndefined(repository?.url),
    repository_source: emptyToUndefined(repository?.source),
    repository_id: emptyToUndefined(repository?.id),
    repository_subfolder: emptyToUndefined(repository?.subfolder),
    
    // Website - convert empty strings to undefined
    website_url: emptyToUndefined(officialServer.websiteUrl),
    
    // Official format storage (will be JSON stringified by create-global.ts)
    // Use packagesCopy which now has inferred command/args
    // Use cleanedRemotes which has base URLs without query params (query params moved to three-tier config)
    packages: packagesCopy,
    remotes: cleanedRemotes,
    
    // Derived DeployStack fields
    transport_type: transportType,
    
    // 3-tier configuration schema
    configuration_schema: configurationSchema,
    
    // Defaults for global servers from official registry
    featured: false,
    auto_install_new_default_team: false,
  };
  
  // Optionally enhance with GitHub metadata
  // Skip if repository URL is empty or undefined
  if (options?.fetchGitHubMetadata && options.logger && repository?.url && repository.url !== '') {
    try {
      const githubData = await enhanceWithGitHubMetadata(
        repository.url,
        baseData,
        options.logger
      );
      
      // Merge GitHub enhancements
      return { ...baseData, ...githubData };
    } catch (error) {
      // Check if this is a rate limit error - if so, throw to trigger job retry
      if (isGitHubRateLimitError(error)) {
        options.logger.warn({
          repositoryUrl: repository.url,
          serverName: officialServer.name,
          error: error instanceof Error ? error.message : String(error),
          operation: 'github_rate_limit_detected'
        }, 'GitHub rate limit detected, will retry job');
        throw error; // Re-throw to trigger job queue retry
      }
      
      // For other errors, log and continue without GitHub data
      options.logger.warn({
        repositoryUrl: repository.url,
        serverName: officialServer.name,
        error: error instanceof Error ? error.message : String(error),
        operation: 'github_enhancement_failed'
      }, 'Failed to enhance with GitHub metadata, continuing without it');
    }
  }
  
  return baseData;
}

/**
 * Validate official server data structure
 * 
 * @param data - Data to validate
 * @returns True if valid official server
 */
export function isValidOfficialServer(data: unknown): data is OfficialServer {
  if (!data || typeof data !== 'object') return false;
  const obj = data as any;
  
  return (
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.version === 'string'
  );
}

/**
 * Enhance server data with GitHub repository metadata
 * 
 * @param repositoryUrl - GitHub repository URL
 * @param baseData - Base server data to enhance
 * @param logger - Logger for GitHub API calls
 * @returns Enhanced server data fields
 */
async function enhanceWithGitHubMetadata(
  repositoryUrl: string,
  baseData: Partial<CreateGlobalServerRequest>,
  logger: FastifyBaseLogger
): Promise<Partial<CreateGlobalServerRequest>> {
  // Only process GitHub URLs
  if (!repositoryUrl.includes('github.com')) {
    logger.debug({
      repositoryUrl,
      operation: 'skip_non_github'
    }, 'Skipping non-GitHub repository URL');
    return {};
  }
  
  logger.debug({
    repositoryUrl,
    operation: 'github_enhancement_start'
  }, 'Starting GitHub metadata enhancement');
  
  // Fetch GitHub repository info using existing GitHubService
  const githubInfo = await GitHubService.getRepositoryInfo(repositoryUrl, logger);
  
  logger.info({
    repositoryUrl,
    stars: githubInfo.stars,
    forks: githubInfo.forks,
    language: githubInfo.language,
    topics: githubInfo.topics,
    github_account_id: githubInfo.github_account_id,
    operation: 'github_enhancement_complete'
  }, 'Successfully enhanced with GitHub metadata');
  
  // Merge GitHub-enhanced fields
  const enhancements: Partial<CreateGlobalServerRequest> = {
    // Use GitHub language/runtime if more specific than package detection
    language: githubInfo.language && githubInfo.language !== 'unknown' 
      ? githubInfo.language.toLowerCase() 
      : baseData.language,
    
    // Enhanced license information from GitHub
    license: githubInfo.license || baseData.license,
    
    // GitHub stars count
    github_stars: githubInfo.stars,
    
    // GitHub account ID for avatar support (convert null to undefined)
    github_account_id: githubInfo.github_account_id || undefined,
    
    // Author and organization from GitHub
    author_name: githubInfo.author_name || baseData.author_name,
    organization: githubInfo.organization || baseData.organization,
    
    // Git branch (default branch from GitHub)
    git_branch: githubInfo.defaultBranch,
    
    // Enhanced description with GitHub data
    long_description: githubInfo.description || baseData.description,
    
    // Use GitHub homepage if no website URL provided
    website_url: baseData.website_url || githubInfo.homepage,
    
    // Merge topics with existing tags
    tags: [
      ...new Set([
        ...(githubInfo.topics || []),
        'mcp',
        'mcp-server',
      ])
    ],
  };
  
  logger.debug({
    repositoryUrl,
    enhancedFields: Object.keys(enhancements),
    operation: 'github_enhancement_merged'
  }, 'GitHub enhancements merged successfully');
  
  return enhancements;
}

/**
 * Check if error is a GitHub rate limit error
 * 
 * @param error - Error to check
 * @returns True if rate limit error
 */
export function isGitHubRateLimitError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = String(error);
  
  return (
    errorMessage.includes('rate limit') ||
    errorMessage.includes('429') ||
    errorString.includes('rate limit') ||
    errorString.includes('429')
  );
}

/**
 * Extract server metadata from official registry _meta field
 * 
 * @param officialServer - Official server data
 * @returns Extracted metadata for tracking
 */
export function extractOfficialMetadata(officialServer: OfficialServer): {
  official_name: string;
  official_registry_server_id: string | null;
  official_registry_version_id: string | null;
  official_registry_published_at: Date | null;
  official_registry_updated_at: Date | null;
  synced_from_official_registry: boolean;
} {
  const meta = officialServer._meta?.['io.modelcontextprotocol.registry/official'];
  
  return {
    official_name: officialServer.name,
    official_registry_server_id: meta?.serverId || null,
    official_registry_version_id: meta?.versionId || null,
    official_registry_published_at: meta?.publishedAt ? new Date(meta.publishedAt) : null,
    official_registry_updated_at: meta?.updatedAt ? new Date(meta.updatedAt) : null,
    synced_from_official_registry: true,
  };
}
