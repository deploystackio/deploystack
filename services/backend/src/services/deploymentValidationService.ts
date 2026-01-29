import { createAppAuth } from '@octokit/auth-app';
import { Octokit as OctokitConstructor } from '@octokit/rest';
import type { DeploymentCredentialService } from './deploymentCredentialService';
import { getGitHubAppConfig } from '../lib/deployment/github-config';
import { RuntimeDetector, type Runtime, type McpSdkInfo } from '../lib/deployment/runtime-detector';

export interface ValidationMetadata {
  // Package.json data (Node.js) or equivalent
  name?: string;
  version?: string;
  description?: string;
  license?: string;

  // Runtime detection
  runtime: Runtime;

  // MCP SDK detection
  mcp_sdk: McpSdkInfo;

  // Build scripts (Node.js only)
  scripts?: {
    build?: string;
    start?: string;
    install?: string;
    [key: string]: string | undefined;
  };

  // Git metadata
  commit_sha: string;
}

export interface ValidationResult {
  valid: boolean;
  metadata?: ValidationMetadata;
  error?: string;
  step?: string;
}

export interface ValidationOptions {
  teamId: string;
  repository_url: string;
  branch: string;
  userId: string;
}

/**
 * Helper function to parse GitHub URL
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+?)(\.git)?$/);
  if (!match) {
    throw new Error('Invalid GitHub URL format');
  }
  return { owner: match[1], repo: match[2] };
}

/**
 * Shared validation service for GitHub repository deployment
 * Used by BOTH /deploy and /validate endpoints to avoid code duplication
 */
export class DeploymentValidationService {
  /**
   * Validates a GitHub repository and returns metadata
   *
   * Steps:
   * 1. Parse GitHub URL
   * 2. Get GitHub App installation token (verifies team access)
   * 3. Validate repository exists
   * 4. Validate branch exists
   * 5. Detect runtime (Node.js/Python/Go)
   * 6. Detect MCP SDK
   * 7. Extract scripts (if applicable)
   * 8. Get commit SHA
   */
  static async validate(
    options: ValidationOptions,
    credentialService: DeploymentCredentialService
  ): Promise<ValidationResult> {
    const { teamId, repository_url, branch } = options;

    try {
      // ============================================
      // STEP 1: Parse GitHub URL
      // ============================================
      let owner: string;
      let repo: string;
      try {
        const parsed = parseGitHubUrl(repository_url);
        owner = parsed.owner;
        repo = parsed.repo;
      } catch {
        return {
          valid: false,
          error: 'Invalid GitHub URL format. Expected: https://github.com/owner/repo',
          step: 'parse_github_url'
        };
      }

      // ============================================
      // STEP 2: Get GitHub App Installation Token
      // ============================================
      const githubInstallation = await credentialService.getInstallation(teamId, 'github');
      if (!githubInstallation) {
        return {
          valid: false,
          error: 'Team does not have GitHub App installed. Please install the GitHub App first.',
          step: 'check_github_installation'
        };
      }

      // Generate ephemeral installation access token (1-hour expiry)
      const config = await getGitHubAppConfig();

      const auth = createAppAuth({
        appId: config.appId,
        privateKey: config.privateKey,
        installationId: githubInstallation.installationId
      });

      const { token } = await auth({ type: 'installation' });
      const octokit = new OctokitConstructor({ auth: token });

      // ============================================
      // STEP 3: Validate Repository Exists
      // ============================================
      try {
        const { data: repoData } = await octokit.repos.get({ owner, repo });

        // Check if repository is empty (no commits)
        if (repoData.size === 0 || !repoData.default_branch) {
          return {
            valid: false,
            error: `Repository ${owner}/${repo} is empty. Please push code to the repository before deploying.`,
            step: 'validate_repository_not_empty'
          };
        }
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          return {
            valid: false,
            error: `Repository ${owner}/${repo} not found or not accessible. Ensure the GitHub App has access to this repository.`,
            step: 'validate_repository_access'
          };
        }
        throw error;
      }

      // ============================================
      // STEP 4: Get Latest Commit SHA
      // ============================================
      let commitSha: string;
      try {
        const { data: branchData } = await octokit.repos.getBranch({
          owner,
          repo,
          branch
        });
        commitSha = branchData.commit.sha;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
          return {
            valid: false,
            error: `Branch '${branch}' not found in ${owner}/${repo}. Please check the branch name.`,
            step: 'validate_branch_exists'
          };
        }
        throw error;
      }

      // ============================================
      // STEP 5: Detect Runtime and MCP SDK
      // ============================================
      const runtimeResult = await RuntimeDetector.detectRuntime(
        octokit,
        owner,
        repo,
        commitSha
      );

      // If no MCP SDK detected, return error
      if (!runtimeResult.mcp_sdk.detected) {
        const runtimeName = runtimeResult.runtime !== 'unknown'
          ? runtimeResult.runtime
          : 'any supported language';
        return {
          valid: false,
          error: `Not a valid MCP server (missing MCP SDK dependency for ${runtimeName})`,
          step: 'validate_mcp_sdk'
        };
      }

      // For Node.js, ensure package.json has required fields
      if (runtimeResult.runtime === 'node' && runtimeResult.packageJson) {
        if (!runtimeResult.packageJson.name) {
          return {
            valid: false,
            error: 'package.json missing required "name" field',
            step: 'validate_package_json'
          };
        }
      }

      // ============================================
      // STEP 6: Return Validation Metadata
      // ============================================
      return {
        valid: true,
        metadata: {
          name: runtimeResult.packageJson?.name,
          version: runtimeResult.packageJson?.version,
          description: runtimeResult.packageJson?.description,
          license: runtimeResult.packageJson?.license,
          runtime: runtimeResult.runtime,
          mcp_sdk: runtimeResult.mcp_sdk,
          scripts: runtimeResult.scripts,
          commit_sha: commitSha
        }
      };

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        valid: false,
        error: errorMessage,
        step: 'internal_error'
      };
    }
  }
}
