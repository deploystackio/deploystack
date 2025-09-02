export interface CachedDeviceInfo {
  // Core device information
  deviceInfo: DeviceInfo;
  
  // Cache metadata
  cachedAt: string;           // ISO timestamp of cache creation
  cacheVersion: string;       // Cache format version for migrations
  
  // Integrity protection
  checksum: string;           // SHA256 of deviceInfo + salt
  salt: string;               // Random salt for checksum
  
  // Hardware change detection
  hardwareSignature: string; // Lightweight hardware signature for validation
}

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
