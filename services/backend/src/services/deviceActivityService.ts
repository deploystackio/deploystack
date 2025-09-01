import { eq } from 'drizzle-orm';
import { devices } from '../db/schema.sqlite';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';

/**
 * Service for tracking device activity by updating last_activity_at timestamps
 * Used across different API endpoints to maintain enterprise device management features
 */
export class DeviceActivityService {
  private db: AnyDatabase;
  private logger: FastifyBaseLogger;

  constructor(db: AnyDatabase, logger: FastifyBaseLogger) {
    this.db = db;
    this.logger = logger.child({ service: 'DeviceActivityService' });
  }

  /**
   * Updates the last_activity_at timestamp for a device identified by hardware_id
   * This method is designed to be non-blocking and should not throw errors that affect API responses
   * 
   * @param hardwareId - The unique hardware fingerprint of the device
   * @param options - Optional configuration
   * @returns Promise<boolean> - true if update was successful, false otherwise
   */
  async updateDeviceActivity(
    hardwareId: string,
    options: {
      updateLastIp?: string;
      silent?: boolean; // If true, don't log errors
    } = {}
  ): Promise<boolean> {
    try {
      if (!hardwareId || typeof hardwareId !== 'string') {
        if (!options.silent) {
          this.logger.warn({
            operation: 'update_device_activity',
            hardwareId,
            error: 'invalid_hardware_id'
          }, 'Invalid hardware_id provided');
        }
        return false;
      }

      const now = new Date();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        last_activity_at: now,
        updated_at: now,
      };

      // Optionally update last known IP address
      if (options.updateLastIp) {
        updateData.last_ip = options.updateLastIp;
      }

      const result = await this.db
        .update(devices)
        .set(updateData)
        .where(eq(devices.hardware_id, hardwareId))
        .run();

      // Check if any rows were affected (device was found and updated)
      const success = result.changes > 0;

      if (!success && !options.silent) {
        this.logger.warn({
          operation: 'update_device_activity',
          hardwareId,
          error: 'device_not_found'
        }, 'No device found with hardware_id');
      }

      return success;
    } catch (error) {
      if (!options.silent) {
        this.logger.error({
          operation: 'update_device_activity',
          hardwareId,
          error,
          updateLastIp: options.updateLastIp
        }, 'Failed to update device activity');
      }
      return false;
    }
  }

  /**
   * Updates device activity and also sets last_login_at (for login scenarios)
   * 
   * @param hardwareId - The unique hardware fingerprint of the device
   * @param options - Optional configuration
   * @returns Promise<boolean> - true if update was successful, false otherwise
   */
  async updateDeviceLogin(
    hardwareId: string,
    options: {
      updateLastIp?: string;
      silent?: boolean;
    } = {}
  ): Promise<boolean> {
    try {
      if (!hardwareId || typeof hardwareId !== 'string') {
        if (!options.silent) {
          this.logger.warn({
            operation: 'update_device_login',
            hardwareId,
            error: 'invalid_hardware_id'
          }, 'Invalid hardware_id provided');
        }
        return false;
      }

      const now = new Date();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: any = {
        last_activity_at: now,
        last_login_at: now,
        updated_at: now,
      };

      // Optionally update last known IP address
      if (options.updateLastIp) {
        updateData.last_ip = options.updateLastIp;
      }

      const result = await this.db
        .update(devices)
        .set(updateData)
        .where(eq(devices.hardware_id, hardwareId))
        .run();

      const success = result.changes > 0;

      if (!success && !options.silent) {
        this.logger.warn({
          operation: 'update_device_login',
          hardwareId,
          error: 'device_not_found'
        }, 'No device found with hardware_id');
      }

      return success;
    } catch (error) {
      if (!options.silent) {
        this.logger.error({
          operation: 'update_device_login',
          hardwareId,
          error,
          updateLastIp: options.updateLastIp
        }, 'Failed to update device login activity');
      }
      return false;
    }
  }

  /**
   * Gets device information by hardware_id (useful for debugging)
   * 
   * @param hardwareId - The unique hardware fingerprint of the device
   * @returns Promise<Device | null> - Device record or null if not found
   */
  async getDeviceByHardwareId(hardwareId: string) {
    try {
      if (!hardwareId || typeof hardwareId !== 'string') {
        return null;
      }

      const device = await this.db
        .select()
        .from(devices)
        .where(eq(devices.hardware_id, hardwareId))
        .get();

      return device || null;
    } catch (error) {
      this.logger.error({
        operation: 'get_device_by_hardware_id',
        hardwareId,
        error
      }, 'Failed to get device by hardware_id');
      return null;
    }
  }
}

/**
 * Utility function to create a DeviceActivityService instance
 * Can be used in route handlers for quick access
 * 
 * @param db - Database instance
 * @param logger - Fastify logger instance
 * @returns DeviceActivityService instance
 */
export function createDeviceActivityService(db: AnyDatabase, logger: FastifyBaseLogger): DeviceActivityService {
  return new DeviceActivityService(db, logger);
}

/**
 * Helper function for fire-and-forget device activity updates
 * Use this in API endpoints where you don't want to wait for the update to complete
 * 
 * @param db - Database instance
 * @param hardwareId - The unique hardware fingerprint of the device
 * @param logger - Fastify logger instance
 * @param options - Optional configuration
 */
export async function trackDeviceActivity(
  db: AnyDatabase,
  hardwareId: string,
  logger: FastifyBaseLogger,
  options: {
    updateLastIp?: string;
    silent?: boolean;
  } = {}
): Promise<void> {
  // Fire and forget - don't await this
  const service = new DeviceActivityService(db, logger);
  service.updateDeviceActivity(hardwareId, { ...options, silent: true }).catch(() => {
    // Silently ignore errors in fire-and-forget mode
  });
}
