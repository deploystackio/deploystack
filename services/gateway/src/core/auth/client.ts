// Re-export the main OAuth2 client and API client for backwards compatibility
export { OAuth2Client } from './oauth';
export { DeployStackAPI } from './api-client';
export { CredentialStorage } from './storage';
export { BrowserManager } from './browser';
export { CallbackServer } from './callback-server';

// Legacy AuthClient class for backwards compatibility
export class AuthClient {
  // This class is deprecated - use OAuth2Client instead
  constructor() {
    console.warn('AuthClient is deprecated. Use OAuth2Client instead.');
  }
}
