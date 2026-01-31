import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { getGitHubAppConfig } from '../lib/deployment/github-config';
import { DeploymentCredentialService } from './deploymentCredentialService';
import type { AnyDatabase } from '../db';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
  private: boolean;
  updatedAt: string;
}

interface RepositoryDetails {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description: string | null;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
  private: boolean;
}

export class DeploymentGitHubService {
  private readonly credentialService: DeploymentCredentialService;

  constructor(db: AnyDatabase) {
    this.credentialService = new DeploymentCredentialService(db);
  }

  /**
   * Get GitHub App installation URL
   */
  async getInstallationUrl(teamId: string): Promise<string> {
    const config = await getGitHubAppConfig();
    return `https://github.com/apps/${config.appSlug}/installations/new?state=${teamId}`;
  }

  /**
   * Create installation access token (ephemeral, 1-hour expiry)
   * Uses GitHub App credentials to generate token for installation
   */
  async createInstallationAccessToken(installationId: string): Promise<string> {
    const config = await getGitHubAppConfig();

    const auth = createAppAuth({
      appId: config.appId,
      privateKey: config.privateKey,
      installationId: installationId
    });

    const { token } = await auth({ type: 'installation' });
    return token;
  }

  /**
   * Get user's repositories from GitHub
   */
  async getUserRepositories(teamId: string): Promise<Repository[]> {
    const installation = await this.credentialService.getInstallation(teamId, 'github');
    if (!installation) {
      throw new Error('Team does not have GitHub App installed. Install the app first.');
    }

    // Generate ephemeral installation token (1-hour expiry)
    const accessToken = await this.createInstallationAccessToken(installation.installationId);
    const octokit = new Octokit({ auth: accessToken });

    const { data } = await octokit.apps.listReposAccessibleToInstallation({
      per_page: 100
    });

    return data.repositories.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      description: repo.description,
      url: repo.html_url,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
      private: repo.private,
      updatedAt: repo.updated_at || new Date().toISOString()
    }));
  }

  /**
   * Verify that a GitHub App installation still exists and is active
   * Queries GitHub API to check installation status
   * Returns true if installation exists and is not suspended, false otherwise
   */
  async verifyInstallation(installationId: string): Promise<boolean> {
    try {
      const config = await getGitHubAppConfig();

      const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: config.appId,
          privateKey: config.privateKey
        }
      });

      // Query GitHub API for this specific installation
      const { data: installation } = await appOctokit.apps.getInstallation({
        installation_id: parseInt(installationId, 10)
      });

      // Check if installation is suspended
      if (installation.suspended_at) {
        return false;
      }

      return true;
    } catch (error: unknown) {
      // Check if it's a 404 (installation doesn't exist)
      if (error && typeof error === 'object' && 'status' in error && error.status === 404) {
        return false;
      }

      // Other errors (network, GitHub API down, etc.) - log and throw
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`GitHub installation verification failed: ${message}`);
    }
  }

  /**
   * List all GitHub App installations accessible to this app
   * Returns installations sorted by most recent (updated_at descending)
   * Filters out suspended installations
   */
  async listInstallations(): Promise<Array<{
    id: number;
    account: {
      login: string;
      id: number;
    };
    created_at: string;
    updated_at: string;
    repository_selection: 'all' | 'selected';
    suspended_at: string | null;
  }>> {
    try {
      const config = await getGitHubAppConfig();

      const appOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: config.appId,
          privateKey: config.privateKey
        }
      });

      // Query GitHub API for all installations
      const { data: installations } = await appOctokit.apps.listInstallations({
        per_page: 100
      });

      // Filter out suspended installations and sort by most recent
      return installations
        .filter(installation => !installation.suspended_at)
        .map(installation => ({
          id: installation.id,
          account: {
            login: installation.account?.login || 'unknown',
            id: installation.account?.id || 0
          },
          created_at: installation.created_at,
          updated_at: installation.updated_at,
          repository_selection: installation.repository_selection as 'all' | 'selected',
          suspended_at: installation.suspended_at
        }))
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to list GitHub installations: ${message}`);
    }
  }

  /**
   * Get repository details
   */
  async getRepository(teamId: string, owner: string, repo: string): Promise<RepositoryDetails> {
    const installation = await this.credentialService.getInstallation(teamId, 'github');
    if (!installation) {
      throw new Error('Team does not have GitHub App installed');
    }

    // Generate ephemeral installation token
    const accessToken = await this.createInstallationAccessToken(installation.installationId);
    const octokit = new Octokit({ auth: accessToken });
    const { data } = await octokit.repos.get({ owner, repo });

    return {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      owner: data.owner.login,
      description: data.description,
      url: data.html_url,
      cloneUrl: data.clone_url,
      defaultBranch: data.default_branch,
      private: data.private
    };
  }

  /**
   * Get latest commit SHA for branch
   */
  async getLatestCommitSha(
    teamId: string,
    owner: string,
    repo: string,
    branch: string
  ): Promise<string> {
    const installation = await this.credentialService.getInstallation(teamId, 'github');
    if (!installation) {
      throw new Error('Team does not have GitHub App installed');
    }

    // Generate ephemeral installation token
    const accessToken = await this.createInstallationAccessToken(installation.installationId);
    const octokit = new Octokit({ auth: accessToken });
    const { data } = await octokit.repos.getBranch({ owner, repo, branch });

    return data.commit.sha;
  }
}
