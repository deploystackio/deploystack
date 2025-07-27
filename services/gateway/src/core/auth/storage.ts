import { keyring } from '@zowe/secrets-for-zowe-sdk';
import { writeFileSync, readFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { StoredCredentials, AuthError, AuthenticationError } from '../../types/auth';

export class CredentialStorage {
  private readonly serviceName = 'deploystack-gateway';
  private readonly fallbackDir = join(homedir(), '.deploystack');
  private readonly fallbackFile = join(this.fallbackDir, 'credentials.enc');
  private readonly accountsFile = join(this.fallbackDir, 'accounts.json');
  private readonly encryptionKey = 'deploystack-gateway-key';

  /**
   * Store credentials securely using OS keychain with encrypted file fallback
   * @param credentials Credentials to store
   */
  async storeCredentials(credentials: StoredCredentials): Promise<void> {
    let keychainError: Error | null = null;
    
    try {
      // Try OS keychain first
      await keyring.setPassword(
        this.serviceName,
        credentials.userEmail,
        JSON.stringify(credentials)
      );
      
      // Also maintain a list of accounts for retrieval
      await this.addToAccountsList(credentials.userEmail);
      
      console.log('✓ Credentials stored in OS keychain');
      return; // Success, no need for fallback
    } catch (error) {
      keychainError = error as Error;
      console.log('⚠ Keychain storage failed, trying encrypted file fallback...');
    }

    // Fallback to encrypted file storage
    try {
      await this.storeEncrypted(credentials);
      console.log('✓ Credentials stored in encrypted file');
    } catch (fallbackError) {
      console.error('❌ Both keychain and file storage failed:');
      console.error('Keychain error:', keychainError?.message);
      console.error('File error:', (fallbackError as Error)?.message);
      throw new AuthenticationError(
        AuthError.STORAGE_ERROR,
        'Failed to store credentials securely',
        fallbackError as Error
      );
    }
  }

  /**
   * Retrieve stored credentials
   * @returns Stored credentials or null if not found
   */
  async getCredentials(): Promise<StoredCredentials | null> {
    // REMOVED: console.log('🔍 Attempting to retrieve stored credentials...');
    
    // First try encrypted file (more reliable for single-user scenario)
    try {
      // REMOVED: console.log('📁 Checking encrypted file:', this.fallbackFile);
      const encryptedCredentials = await this.retrieveEncrypted();
      if (encryptedCredentials) {
        // REMOVED: console.log('✓ Found credentials in encrypted file');
        return encryptedCredentials;
      } else {
        // REMOVED: console.log('⚠ No credentials found in encrypted file');
      }
    } catch (error) {
      // REMOVED: console.log('❌ Error reading encrypted file:', (error as Error)?.message);
    }

    // Fallback to keychain
    try {
      // REMOVED: console.log('🔑 Checking OS keychain...');
      const accounts = await this.getStoredAccounts();
      // REMOVED: console.log('📋 Found accounts:', accounts);
      
      if (accounts.length > 0) {
        // Try each account until we find valid credentials
        for (const account of accounts) {
          try {
            const stored = await keyring.getPassword(this.serviceName, account);
            if (stored) {
              const credentials = JSON.parse(stored);
              // REMOVED: console.log('✓ Found credentials in OS keychain for:', account);
              return credentials;
            }
          } catch (error) {
            // REMOVED: console.log('⚠ Failed to retrieve credentials for account:', account);
            continue;
          }
        }
      } else {
        // REMOVED: console.log('⚠ No accounts found in keychain');
      }
    } catch (error) {
      // REMOVED: console.log('❌ Error accessing keychain:', (error as Error)?.message);
    }

    // REMOVED: console.log('❌ No credentials found in any storage method');
    return null;
  }

  /**
   * Update the selected team in stored credentials
   * @param teamId Team ID to select
   * @param teamName Team name to select
   */
  async updateSelectedTeam(teamId: string, teamName: string): Promise<void> {
    const credentials = await this.getCredentials();
    if (!credentials) {
      throw new AuthenticationError(
        AuthError.STORAGE_ERROR,
        'No stored credentials found to update'
      );
    }

    credentials.selectedTeam = {
      id: teamId,
      name: teamName
    };

    await this.storeCredentials(credentials);
  }

  /**
   * Get the currently selected team
   * @returns Selected team info or null if none selected
   */
  async getSelectedTeam(): Promise<{ id: string; name: string } | null> {
    const credentials = await this.getCredentials();
    return credentials?.selectedTeam || null;
  }

  /**
   * Clear stored credentials
   * @param userEmail Optional specific user email to clear
   */
  async clearCredentials(userEmail?: string): Promise<void> {
    try {
      if (userEmail) {
        await keyring.deletePassword(this.serviceName, userEmail);
        await this.removeFromAccountsList(userEmail);
      } else {
        // Clear all stored accounts
        const accounts = await this.getStoredAccounts();
        for (const account of accounts) {
          try {
            await keyring.deletePassword(this.serviceName, account);
          } catch (error) {
            // Continue clearing other accounts even if one fails
          }
        }
        await this.clearAccountsList();
      }
    } catch (error) {
      // Continue to clear encrypted file even if keychain fails
    }

    // Also clear encrypted file
    await this.clearEncrypted();
  }

  /**
   * Check if user is authenticated with valid credentials
   * @returns true if authenticated with non-expired credentials
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const credentials = await this.getCredentials();
      if (!credentials) {
        return false;
      }

      // Check if token is expired (with 5 minute buffer)
      const now = Date.now();
      const expiresAt = credentials.expiresAt;
      const buffer = 5 * 60 * 1000; // 5 minutes

      return expiresAt > (now + buffer);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get list of stored account emails
   * @returns Array of account emails
   */
  private async getStoredAccounts(): Promise<string[]> {
    try {
      if (existsSync(this.accountsFile)) {
        const data = readFileSync(this.accountsFile, 'utf8');
        const accounts = JSON.parse(data);
        return Array.isArray(accounts) ? accounts : [];
      }
    } catch (error) {
      // If we can't read the accounts file, return empty array
    }
    return [];
  }

  /**
   * Add account to the accounts list
   * @param email User email to add
   */
  private async addToAccountsList(email: string): Promise<void> {
    try {
      // Ensure directory exists
      const { mkdirSync } = await import('fs');
      try {
        mkdirSync(this.fallbackDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      const accounts = await this.getStoredAccounts();
      if (!accounts.includes(email)) {
        accounts.unshift(email); // Add to beginning (most recent first)
        writeFileSync(this.accountsFile, JSON.stringify(accounts, null, 2));
      }
    } catch (error) {
      // Non-critical error, don't throw
      console.log('⚠ Failed to update accounts list:', (error as Error)?.message);
    }
  }

  /**
   * Remove account from the accounts list
   * @param email User email to remove
   */
  private async removeFromAccountsList(email: string): Promise<void> {
    try {
      const accounts = await this.getStoredAccounts();
      const filtered = accounts.filter(account => account !== email);
      if (filtered.length !== accounts.length) {
        writeFileSync(this.accountsFile, JSON.stringify(filtered, null, 2));
      }
    } catch (error) {
      // Non-critical error, don't throw
    }
  }

  /**
   * Clear the accounts list
   */
  private async clearAccountsList(): Promise<void> {
    try {
      if (existsSync(this.accountsFile)) {
        unlinkSync(this.accountsFile);
      }
    } catch (error) {
      // Non-critical error, don't throw
    }
  }

  /**
   * Store credentials in encrypted file as fallback
   * @param credentials Credentials to store
   */
  private async storeEncrypted(credentials: StoredCredentials): Promise<void> {
    try {
      // Ensure directory exists
      const { mkdirSync } = await import('fs');
      try {
        mkdirSync(this.fallbackDir, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }

      // Encrypt and store
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
      let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const encryptedData = iv.toString('hex') + ':' + encrypted;

      writeFileSync(this.fallbackFile, encryptedData, { mode: 0o600 });
    } catch (error) {
      throw new AuthenticationError(
        AuthError.STORAGE_ERROR,
        'Failed to store credentials in encrypted file',
        error as Error
      );
    }
  }

  /**
   * Retrieve credentials from encrypted file
   * @returns Stored credentials or null
   */
  private async retrieveEncrypted(): Promise<StoredCredentials | null> {
    try {
      if (!existsSync(this.fallbackFile)) {
        return null;
      }

      const encryptedData = readFileSync(this.fallbackFile, 'utf8');
      const parts = encryptedData.split(':');
      if (parts.length !== 2) throw new Error('Invalid encrypted data format');
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      // If we can't decrypt, the file might be corrupted
      try {
        unlinkSync(this.fallbackFile);
      } catch (unlinkError) {
        // Ignore unlink errors
      }
      return null;
    }
  }

  /**
   * Clear encrypted file
   */
  private async clearEncrypted(): Promise<void> {
    try {
      if (existsSync(this.fallbackFile)) {
        unlinkSync(this.fallbackFile);
      }
    } catch (error) {
      // Ignore errors when clearing
    }
  }
}
