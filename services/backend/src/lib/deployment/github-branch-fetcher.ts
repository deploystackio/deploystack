import type { DeploymentGitHubService } from '../../services/deploymentGitHubService';

/**
 * Branch information from GitHub repository
 */
export interface BranchInfo {
  name: string;
  commit_sha: string;
  protected: boolean;
}

/**
 * Result of fetching repository branches
 */
export interface RepositoryBranchesResult {
  branches: BranchInfo[];
  default_branch: string;
}

/**
 * Fetches branches from a GitHub repository
 *
 * @param owner - Repository owner (username or organization)
 * @param repo - Repository name
 * @param installationId - GitHub App installation ID
 * @param githubService - Deployment GitHub service instance
 * @returns Repository branches and default branch
 * @throws Error if repository is empty or API call fails
 */
export async function fetchRepositoryBranches(
  owner: string,
  repo: string,
  installationId: string,
  githubService: DeploymentGitHubService
): Promise<RepositoryBranchesResult> {
  // Generate ephemeral installation access token
  const accessToken = await githubService.createInstallationAccessToken(installationId);

  // Create Octokit client with installation token
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: accessToken });

  // Get repository details for default branch
  const { data: repoData } = await octokit.repos.get({ owner, repo });

  // Check if repository is empty (only check for default branch, not size)
  // Note: GitHub's size field is in KB and can be 0 for very small repos
  if (!repoData.default_branch) {
    throw new Error(`Repository ${owner}/${repo} is empty. Please push code to the repository before deploying.`);
  }

  // List branches (up to 100)
  const { data: branches } = await octokit.repos.listBranches({
    owner,
    repo,
    per_page: 100
  });

  // Return structured response
  return {
    branches: branches.map(branch => ({
      name: branch.name,
      commit_sha: branch.commit.sha,
      protected: branch.protected
    })),
    default_branch: repoData.default_branch
  };
}
