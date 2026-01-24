import { GlobalSettings } from '../../global-settings/helpers';

export interface GitHubAppConfig {
  appId: string;
  appSlug: string;
  privateKey: string;    // Decrypted
  webhookSecret: string; // Decrypted
}

/**
 * Load GitHub App credentials from global settings
 * All sensitive credentials are automatically decrypted by GlobalSettings
 */
export async function getGitHubAppConfig(): Promise<GitHubAppConfig> {
  // Check if deployment enabled
  const deploymentEnabled = await GlobalSettings.get('deployment.enabled');
  if (deploymentEnabled !== 'true') {
    throw new Error('GitHub deployment is not enabled. Enable in Admin → Settings → Deployment');
  }

  // Load credentials (GlobalSettings handles decryption for encrypted values)
  const appId = await GlobalSettings.get('deployment.github_app.app_id');
  const appSlug = await GlobalSettings.get('deployment.github_app.app_slug');
  const privateKeyBase64 = await GlobalSettings.get('deployment.github_app.private_key_base64');
  const webhookSecret = await GlobalSettings.get('deployment.github_app.webhook_secret');

  // Validate all credentials exist
  if (!appId || !appSlug || !privateKeyBase64 || !webhookSecret) {
    throw new Error('GitHub App not fully configured. Check Admin → Settings → Deployment');
  }

  // Decode base64 private key
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf8');

  return {
    appId,
    appSlug,
    privateKey,
    webhookSecret
  };
}

/**
 * Get backend URL for constructing webhook URLs
 */
export async function getBackendUrl(): Promise<string> {
  const backendUrl = await GlobalSettings.get('global.backend_url');
  if (!backendUrl) {
    throw new Error('global.backend_url not configured');
  }
  return backendUrl;
}
