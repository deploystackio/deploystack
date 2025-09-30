/* eslint-disable @typescript-eslint/no-explicit-any */
import { type FastifyInstance } from 'fastify';
import { GitHubService } from '../../../services/githubService';

// Helper function to infer runtime from language
function inferRuntime(language: string): string {
  const languageMap: Record<string, string> = {
    'TypeScript': 'node',
    'JavaScript': 'node',
    'Python': 'python',
    'Go': 'go',
    'Rust': 'rust',
    'Java': 'java',
    'C#': 'dotnet'
  };
  
  return languageMap[language] || 'node';
}

// Helper function to infer installation methods
function inferInstallationMethods(packageInfo: any, language: string): any[] {
  const methods = [];
  
  if (packageInfo) {
    if (language === 'TypeScript' || language === 'JavaScript') {
      if (packageInfo.name) {
        methods.push({
          type: 'npm',
          command: `npx ${packageInfo.name}`,
          description: 'Install and run via npm'
        });
      }
    } else if (language === 'Python') {
      if (packageInfo.name) {
        methods.push({
          type: 'pip',
          command: `pip install ${packageInfo.name}`,
          description: 'Install via pip'
        });
      }
    }
  }
  
  // Always add git clone as fallback
  methods.push({
    type: 'git',
    command: 'git clone <repository_url>',
    description: 'Clone repository and build from source'
  });
  
  return methods;
}

export default async function getRepoInfo(server: FastifyInstance) {
  server.get('/mcp/github/repo-info', {
    schema: {
      tags: ['MCP GitHub Integration'],
      summary: 'Get GitHub repository info',
      description: 'Get repository information from GitHub for MCP server creation/validation',
      querystring: {
        type: 'object',
        properties: {
          url: { 
            type: 'string', 
            format: 'uri',
            description: 'GitHub repository URL'
          },
          branch: { 
            type: 'string', 
            default: 'main',
            description: 'Git branch to analyze'
          }
        },
        required: ['url']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                repository_url: { type: 'string' },
                repository_source: { type: 'string' },
                repository_id: { type: 'string', nullable: true },
                repository_subfolder: { type: 'string', nullable: true },
                git_branch: { type: 'string' },
                website_url: { type: 'string', nullable: true },
                author_name: { type: 'string' },
                organization: { type: 'string', nullable: true },
                license: { type: 'string', nullable: true },
                language: { type: 'string' },
                runtime: { type: 'string' },
                tags: { type: 'array', items: { type: 'string' } },
                packages: { type: 'array' },
                dependencies: { type: 'object', nullable: true },
                latest_version: { type: 'string', nullable: true },
                github_account_id: { type: 'string', nullable: true },
                stars: { type: 'number' },
                forks: { type: 'number' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: false },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: false },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { url, branch = 'main' } = request.query as { url: string; branch?: string };
    
    try {
      // Validate GitHub URL format
      if (!url.includes('github.com')) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid GitHub URL. Please provide a valid GitHub repository URL.'
        });
      }
      
      request.log.info({ url, branch }, 'Fetching GitHub repository information');
      
      // Get basic repository information
      const repoInfo = await GitHubService.getRepositoryInfo(url, request.log);
      const { owner, repo } = GitHubService.parseGitHubUrl(url);
      
      // Get package information for technical details
      let packageInfo = null;
      try {
        packageInfo = await GitHubService.getPackageJson(owner, repo, branch || repoInfo.defaultBranch, request.log);
      } catch (error) {
        request.log.debug({ error }, 'No package.json found or accessible');
      }
      
      // Get latest release information
      let latestRelease = null;
      try {
        latestRelease = await GitHubService.getLatestRelease(owner, repo, request.log);
      } catch (error) {
        request.log.debug({ error }, 'No releases found or accessible');
      }
      
      // Structure the response data
      const mcpServerData = {
        // Basic information
        name: repoInfo.name,
        description: repoInfo.description || '',
        repository_url: url,
        repository_source: 'github',
        repository_id: `${owner}/${repo}`,
        repository_subfolder: null,
        git_branch: branch || repoInfo.defaultBranch,
        website_url: repoInfo.homepage || null,
        
        // Author and organization
        author_name: owner,
        organization: owner, // GitHub owner can be user or organization
        license: repoInfo.license || null,
        
        // Technical details
        language: repoInfo.language || 'unknown',
        runtime: inferRuntime(repoInfo.language || ''),
        
        // Metadata
        tags: repoInfo.topics || [],
        
        // MCP Registry packages (inferred from package info)
        packages: inferInstallationMethods(packageInfo, repoInfo.language || ''),
        
        // Dependencies
        dependencies: packageInfo?.dependencies || null,
        
        // Version information
        latest_version: latestRelease?.version || null,
        
        // GitHub integration
        github_account_id: repoInfo.github_account_id,
        
        // Repository stats
        stars: repoInfo.stars || 0,
        forks: repoInfo.forks || 0
      };
      
      request.log.info({ 
        name: mcpServerData.name, 
        language: mcpServerData.language,
        stars: mcpServerData.stars 
      }, 'Successfully fetched repository information');
      
      return reply.send({
        success: true,
        data: mcpServerData
      });
      
    } catch (error: any) {
      request.log.error({ error, url }, 'Failed to fetch GitHub repository information');
      
      // Handle specific GitHub API errors
      if (error.status === 404) {
        return reply.status(400).send({
          success: false,
          error: 'Repository not found. Please check the URL and ensure the repository is public.'
        });
      } else if (error.status === 403) {
        return reply.status(400).send({
          success: false,
          error: 'Access denied. The repository may be private or GitHub API rate limit exceeded.'
        });
      } else if (error.message?.includes('Invalid GitHub URL')) {
        return reply.status(400).send({
          success: false,
          error: error.message
        });
      }
      
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch repository information. Please try again later.'
      });
    }
  });
}
