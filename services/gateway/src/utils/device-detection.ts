import os from 'os';
import crypto from 'crypto';

export interface DeviceInfo {
  hostname: string;
  os_type: string;
  os_version: string;
  arch: string;
  node_version: string;
  hardware_id: string;
  user_agent: string;
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
  last_login_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get platform name in a user-friendly format
 */
function getPlatformName(platform: string): string {
  switch (platform) {
    case 'darwin':
      return 'macOS';
    case 'win32':
      return 'Windows';
    case 'linux':
      return 'Linux';
    default:
      return platform;
  }
}

/**
 * Generate a stable hardware fingerprint for device identification
 */
export async function generateHardwareFingerprint(): Promise<string> {
  try {
    // Get network interfaces for MAC addresses
    const networkInterfaces = os.networkInterfaces();
    const macAddresses = Object.values(networkInterfaces)
      .flat()
      .filter(iface => !iface?.internal && iface?.mac !== '00:00:00:00:00:00')
      .map(iface => iface?.mac)
      .filter(Boolean)
      .sort();

    // Get CPU information
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'unknown';

    // Create fingerprint data
    const fingerprintData = {
      macs: macAddresses,
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpuModel: cpuModel,
      // Add some entropy from system info
      totalmem: os.totalmem(),
      homedir: os.homedir()
    };

    // Generate SHA256 hash
    const fingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');

    // Return first 32 characters for consistency
    return fingerprint.substring(0, 32);
  } catch {
    // Fallback fingerprint if hardware detection fails
    const fallbackData = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      timestamp: Date.now()
    };

    const fallbackFingerprint = crypto
      .createHash('sha256')
      .update(JSON.stringify(fallbackData))
      .digest('hex');

    return fallbackFingerprint.substring(0, 32);
  }
}

/**
 * Detect current device information
 */
export async function detectDeviceInfo(): Promise<DeviceInfo> {
  const packageVersion = process.env.npm_package_version || '1.0.0';
  
  return {
    hostname: os.hostname(),
    os_type: getPlatformName(os.platform()),
    os_version: os.release(),
    arch: os.arch(),
    node_version: process.version,
    hardware_id: await generateHardwareFingerprint(),
    user_agent: `DeployStack-CLI/${packageVersion} (${os.platform()}; ${os.arch()})`
  };
}
