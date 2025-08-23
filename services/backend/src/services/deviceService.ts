import { eq, and, desc, lt } from 'drizzle-orm';
import { type AnyDatabase } from '../db/index';
import { devices } from '../db/schema.sqlite';
import { nanoid } from 'nanoid';
import crypto from 'crypto';
import os from 'os';
import type { FastifyBaseLogger } from 'fastify';

// TypeScript interfaces for type safety
export interface DeviceInfo {
  hostname: string;
  os_type: string;
  os_version: string;
  arch: string;
  node_version: string;
  hardware_id: string;
  user_agent: string;
}

export interface CreateDeviceRequest {
  device_name: string;
  hostname?: string;
  hardware_id: string;
  os_type?: string;
  os_version?: string;
  arch?: string;
  node_version?: string;
  user_agent?: string;
  last_ip?: string;
  last_login_at?: Date;
  last_activity_at?: Date;
}

export interface UpdateDeviceRequest {
  device_name?: string;
  last_ip?: string;
  user_agent?: string;
  os_version?: string;
  node_version?: string;
  last_login_at?: Date;
  last_activity_at?: Date;
}

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  hostname: string | null;
  hardware_id: string | null;
  os_type: string | null;
  os_version: string | null;
  arch: string | null;
  node_version: string | null;
  last_ip: string | null;
  user_agent: string | null;
  is_active: boolean;
  is_trusted: boolean;
  last_login_at: Date | null;
  last_activity_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DeviceStats {
  totalDevices: number;
  activeDevices: number;
  inactiveDevices: number;
  devicesByOS: Record<string, number>;
  recentActivity: Device[];
}

export class DeviceService {
  constructor(private db: AnyDatabase) {}

  /**
   * Generate a stable hardware fingerprint for device identification
   */
  static async generateHardwareFingerprint(): Promise<string> {
    try {
      const networkInterfaces = os.networkInterfaces();
      const macAddresses = Object.values(networkInterfaces)
        .flat()
        .filter(iface => !iface?.internal && iface?.mac !== '00:00:00:00:00:00')
        .map(iface => iface?.mac)
        .filter(Boolean)
        .sort();

      const fingerprint = crypto
        .createHash('sha256')
        .update(JSON.stringify({
          macs: macAddresses,
          hostname: os.hostname(),
          platform: os.platform(),
          arch: os.arch(),
          cpus: os.cpus()[0]?.model || 'unknown' // First CPU model as identifier
        }))
        .digest('hex');

      return fingerprint.substring(0, 32); // 32 character hardware ID
    } catch {
      // Fallback to hostname + platform if hardware detection fails
      const fallback = crypto
        .createHash('sha256')
        .update(`${os.hostname()}-${os.platform()}-${os.arch()}`)
        .digest('hex');
      
      return fallback.substring(0, 32);
    }
  }

  /**
   * Detect current device information
   */
  static async detectDeviceInfo(): Promise<DeviceInfo> {
    const packageVersion = process.env.npm_package_version || '1.0.0';
    
    return {
      hostname: os.hostname(),
      os_type: DeviceService.getPlatformName(os.platform()),
      os_version: os.release(),
      arch: os.arch(),
      node_version: process.version,
      hardware_id: await DeviceService.generateHardwareFingerprint(),
      user_agent: `DeployStack-CLI/${packageVersion} (${os.platform()}; ${os.arch()})`
    };
  }

  /**
   * Convert OS platform to user-friendly name
   */
  static getPlatformName(platform: string): string {
    switch (platform) {
      case 'darwin': return 'macOS';
      case 'win32': return 'Windows';
      case 'linux': return 'Linux';
      case 'freebsd': return 'FreeBSD';
      case 'openbsd': return 'OpenBSD';
      default: return platform;
    }
  }

  /**
   * Create a new device record
   */
  async createDevice(userId: string, deviceData: CreateDeviceRequest): Promise<Device> {
    const deviceId = nanoid();
    const now = new Date();

    const [device] = await this.db
      .insert(devices)
      .values({
        id: deviceId,
        user_id: userId,
        device_name: deviceData.device_name,
        hostname: deviceData.hostname || null,
        hardware_id: deviceData.hardware_id,
        os_type: deviceData.os_type || null,
        os_version: deviceData.os_version || null,
        arch: deviceData.arch || null,
        node_version: deviceData.node_version || null,
        last_ip: deviceData.last_ip || null,
        user_agent: deviceData.user_agent || null,
        last_login_at: deviceData.last_login_at || now,
        last_activity_at: deviceData.last_activity_at || now,
        created_at: now,
        updated_at: now,
      })
      .returning();

    return device as Device;
  }

  /**
   * Get device by hardware ID
   */
  async getDeviceByHardwareId(hardwareId: string): Promise<Device | null> {
    const [device] = await this.db
      .select()
      .from(devices)
      .where(eq(devices.hardware_id, hardwareId))
      .limit(1);

    return device as Device || null;
  }

  /**
   * Get device by ID
   */
  async getDeviceById(deviceId: string): Promise<Device | null> {
    const [device] = await this.db
      .select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    return device as Device || null;
  }

  /**
   * Get all devices for a user
   */
  async getDevicesByUser(userId: string): Promise<Device[]> {
    const userDevices = await this.db
      .select()
      .from(devices)
      .where(eq(devices.user_id, userId))
      .orderBy(desc(devices.last_activity_at));

    return userDevices as Device[];
  }

  /**
   * Update device information
   */
  async updateDevice(deviceId: string, userId: string, updates: UpdateDeviceRequest): Promise<Device> {
    const now = new Date();

    const [updatedDevice] = await this.db
      .update(devices)
      .set({
        ...updates,
        updated_at: now,
      })
      .where(and(
        eq(devices.id, deviceId),
        eq(devices.user_id, userId)
      ))
      .returning();

    if (!updatedDevice) {
      throw new Error('Device not found or access denied');
    }

    return updatedDevice as Device;
  }

  /**
   * Update device activity timestamp
   */
  async updateDeviceActivity(deviceId: string): Promise<void> {
    const now = new Date();

    await this.db
      .update(devices)
      .set({
        last_activity_at: now,
        updated_at: now,
      })
      .where(eq(devices.id, deviceId));
  }

  /**
   * Revoke device access (mark as inactive and untrusted)
   */
  async revokeDevice(deviceId: string, revokedBy: string, logger: FastifyBaseLogger, reason?: string): Promise<void> {
    const now = new Date();

    await this.db
      .update(devices)
      .set({
        is_active: false,
        is_trusted: false,
        updated_at: now,
      })
      .where(eq(devices.id, deviceId));

    // Log security event with structured logging
    logger.warn({
      operation: 'device_revoked',
      deviceId,
      revokedBy,
      reason: reason || null
    }, `Device ${deviceId} revoked by ${revokedBy}${reason ? `: ${reason}` : ''}`);
  }

  /**
   * Remove device (soft delete by marking inactive)
   */
  async removeDevice(deviceId: string, userId: string): Promise<void> {
    const now = new Date();

    const result = await this.db
      .update(devices)
      .set({
        is_active: false,
        updated_at: now,
      })
      .where(and(
        eq(devices.id, deviceId),
        eq(devices.user_id, userId)
      ));

    if (result.changes === 0) {
      throw new Error('Device not found or access denied');
    }
  }

  /**
   * Register or update device during login
   */
  async registerOrUpdateDevice(userId: string, deviceInfo: DeviceInfo): Promise<Device> {
    // Check if device already exists by hardware_id
    const existingDevice = await this.getDeviceByHardwareId(deviceInfo.hardware_id);

    if (existingDevice) {
      // Update existing device
      return await this.updateDevice(existingDevice.id, userId, {
        last_login_at: new Date(),
        last_activity_at: new Date(),
        os_version: deviceInfo.os_version,
        node_version: deviceInfo.node_version,
        user_agent: deviceInfo.user_agent
      });
    } else {
      // Register new device
      return await this.createDevice(userId, {
        device_name: deviceInfo.hostname, // Default to hostname
        hostname: deviceInfo.hostname,
        hardware_id: deviceInfo.hardware_id,
        os_type: deviceInfo.os_type,
        os_version: deviceInfo.os_version,
        arch: deviceInfo.arch,
        node_version: deviceInfo.node_version,
        user_agent: deviceInfo.user_agent,
        last_login_at: new Date(),
        last_activity_at: new Date()
      });
    }
  }

  /**
   * Clean up inactive devices
   */
  async cleanupInactiveDevices(inactiveDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    const result = await this.db
      .update(devices)
      .set({
        is_active: false,
        updated_at: new Date(),
      })
      .where(and(
        eq(devices.is_active, true),
        lt(devices.last_activity_at, cutoffDate)
      ));

    return result.changes || 0;
  }

  /**
   * Get device statistics for admin dashboard
   */
  async getDeviceStats(): Promise<DeviceStats> {
    const allDevices = await this.db.select().from(devices);
    
    const totalDevices = allDevices.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeDevices = allDevices.filter((d: any) => d.is_active).length;
    const inactiveDevices = totalDevices - activeDevices;

    // Group by OS type
    const devicesByOS: Record<string, number> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allDevices.forEach((device: any) => {
      const osType = device.os_type || 'Unknown';
      devicesByOS[osType] = (devicesByOS[osType] || 0) + 1;
    });

    // Get recent activity (last 10 devices)
    const recentActivity = await this.db
      .select()
      .from(devices)
      .where(eq(devices.is_active, true))
      .orderBy(desc(devices.last_activity_at))
      .limit(10);

    return {
      totalDevices,
      activeDevices,
      inactiveDevices,
      devicesByOS,
      recentActivity: recentActivity as Device[]
    };
  }

  /**
   * Validate device access for MCP operations
   */
  async validateDeviceAccess(deviceId: string): Promise<boolean> {
    const device = await this.getDeviceById(deviceId);
    
    if (!device) {
      return false;
    }

    return device.is_active && device.is_trusted;
  }
}
