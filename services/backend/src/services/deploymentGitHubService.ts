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
