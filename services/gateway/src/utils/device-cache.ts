import { keyring } from '@zowe/secrets-for-zowe-sdk';
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { CachedDeviceInfo, DeviceInfo } from '../types/device-cache';
import { generateHardwareSignature } from './device-detection';
import { AuthError, AuthenticationError } from '../types/auth';

export class DeviceInfoCache {
  private static readonly serviceName = 'deploystack-gateway-device-cache';
  private static readonly fallbackDir = join(homedir(), '.deploystack');
  private static readonly fallbackFile = join(DeviceInfoCache.fallbackDir, 'device-cache.enc');
  private static readonly encryptionKey = 'deploystack-device-cache-key';
  private static readonly cacheVersion = '1.0.0';
  private static readonly maxCacheAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  /**
   * Store device info in cache with integrity protection
   * @param deviceInfo Device information to cache
   */
  static async store(deviceInfo: DeviceInfo): Promise<void> {
    try {
      // Generate cache metadata
      const salt = randomBytes(32).toString('hex');
      const checksum = this.computeChecksum(deviceInfo, salt);
      const hardwareSignature = await generateHardwareSignature();
      
      const cachedInfo: CachedDeviceInfo = {
        deviceInfo,
        cachedAt: new Date().toISOString(),
        cacheVersion: this.cacheVersion,
        checksum,
        salt,
        hardwareSignature
      };

      try {
        // Try OS keychain first
        await keyring.setPassword(
          this.serviceName,
          'device-info',
          JSON.stringify(cachedInfo)
        );
        return; // Success, no need for fallback
      } catch {
        // Continue to fallback storage
      }

      // Fallback to encrypted file storage
      try {
        await this.storeEncrypted(cachedInfo);
      } catch (fallbackError) {
        throw new AuthenticationError(
          AuthError.STORAGE_ERROR,
          'Failed to store device cache securely',
          fallbackError as Error
        );
      }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError(
        AuthError.STORAGE_ERROR,
        `Failed to cache device info: ${error instanceof Error ? error.message : String(error)}`,
        error as Error
      );
    }
  }

  /**
   * Retrieve device info from cache with validation
   * @returns Cached device info or null if invalid/missing
   */
  static async retrieve(): Promise<DeviceInfo | null> {
    try {
      // Try encrypted file first (more reliable for single-user scenario)
      try {
        const encryptedCache = await this.retrieveEncrypted();
        if (encryptedCache && await this.validateCache(encryptedCache)) {
          return encryptedCache.deviceInfo;
        }
      } catch {
        // Continue to keychain fallback
      }

      // Fallback to keychain
      try {
        const stored = await keyring.getPassword(this.serviceName, 'device-info');
        if (stored) {
          const cached = JSON.parse(stored) as CachedDeviceInfo;
          if (await this.validateCache(cached)) {
            return cached.deviceInfo;
          }
        }
      } catch {
        // Continue to return null
      }

      return null;
    } catch (error) {
      // Log error but don't throw - cache miss should be handled gracefully
      console.warn('Device cache retrieval error:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Invalidate (clear) the device cache
   */
  static async invalidate(): Promise<void> {
    try {
      // Clear from keychain
      try {
        await keyring.deletePassword(this.serviceName, 'device-info');
      } catch {
        // Continue to clear encrypted file even if keychain fails
      }

      // Clear encrypted file
      await this.clearEncrypted();
    } catch (error) {
      // Non-critical error - cache invalidation should not fail the operation
      console.warn('Device cache invalidation error:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Validate cached device info for integrity and freshness
   * @param cached Cached device info to validate
   * @returns true if cache is valid
   */
  private static async validateCache(cached: CachedDeviceInfo): Promise<boolean> {
    try {
      // Check cache version compatibility
      if (cached.cacheVersion !== this.cacheVersion) {
        return false;
      }

      // Check cache age (invalidate after 30 days)
      const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
      if (cacheAge > this.maxCacheAge) {
        return false;
      }

      // Verify integrity checksum
      const expectedChecksum = this.computeChecksum(cached.deviceInfo, cached.salt);
      if (cached.checksum !== expectedChecksum) {
        return false;
      }

      // Quick hardware change detection
      const currentSignature = await generateHardwareSignature();
      if (cached.hardwareSignature !== currentSignature) {
        return false;
      }

      return true;
    } catch {
      // If validation fails for any reason, consider cache invalid
      return false;
    }
  }

  /**
   * Compute integrity checksum for device info
   * @param deviceInfo Device information
   * @param salt Random salt for checksum
   * @returns SHA256 checksum
   */
  private static computeChecksum(deviceInfo: DeviceInfo, salt: string): string {
    const data = JSON.stringify(deviceInfo, Object.keys(deviceInfo).sort()) + salt;
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Store cached device info in encrypted file as fallback
   * @param cachedInfo Cached device info to store
   */
  private static async storeEncrypted(cachedInfo: CachedDeviceInfo): Promise<void> {
    try {
      // Ensure directory exists
      try {
        mkdirSync(this.fallbackDir, { recursive: true });
      } catch {
        // Directory might already exist
      }

      // Encrypt and store
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey.padEnd(32, '0').slice(0, 32)), iv);
      let encrypted = cipher.update(JSON.stringify(cachedInfo), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const encryptedData = iv.toString('hex') + ':' + encrypted;

      writeFileSync(this.fallbackFile, encryptedData, { mode: 0o600 });
    } catch (error) {
      throw new AuthenticationError(
        AuthError.STORAGE_ERROR,
        'Failed to store device cache in encrypted file',
        error as Error
      );
    }
  }

  /**
   * Retrieve cached device info from encrypted file
   * @returns Cached device info or null
   */
  private static async retrieveEncrypted(): Promise<CachedDeviceInfo | null> {
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

      return JSON.parse(decrypted) as CachedDeviceInfo;
    } catch {
      // If we can't decrypt, the file might be corrupted - remove it
      try {
        unlinkSync(this.fallbackFile);
      } catch {
        // Ignore unlink errors
      }
      return null;
    }
  }

  /**
   * Clear encrypted cache file
   */
  private static async clearEncrypted(): Promise<void> {
    try {
      if (existsSync(this.fallbackFile)) {
        unlinkSync(this.fallbackFile);
      }
    } catch {
      // Ignore errors when clearing
    }
  }

  /**
   * Get cache status for debugging/monitoring
   * @returns Cache status information
   */
  static async getStatus(): Promise<{
    cached: boolean;
    cacheAge?: number;
    cacheVersion?: string;
    hardwareSignatureMatch?: boolean;
  }> {
    try {
      // Try to retrieve cached info without validation
      let cached: CachedDeviceInfo | null = null;
      
      // Try keychain first (matches store() priority)
      try {
        const stored = await keyring.getPassword(this.serviceName, 'device-info');
        if (stored) {
          cached = JSON.parse(stored) as CachedDeviceInfo;
        }
      } catch {
        // Try encrypted file fallback
        try {
          cached = await this.retrieveEncrypted();
        } catch {
          // No cache found
        }
      }

      if (!cached) {
        return { cached: false };
      }

      const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
      const currentSignature = await generateHardwareSignature();
      const hardwareSignatureMatch = cached.hardwareSignature === currentSignature;

      return {
        cached: true,
        cacheAge,
        cacheVersion: cached.cacheVersion,
        hardwareSignatureMatch
      };
    } catch {
      return { cached: false };
    }
  }
}
