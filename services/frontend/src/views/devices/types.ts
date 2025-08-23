/**
 * Device management types for DeployStack frontend
 */

export interface Device {
  id: string
  user_id: string
  device_name: string
  hostname: string | null
  hardware_id: string | null
  os_type: string | null
  os_version: string | null
  arch: string | null
  node_version: string | null
  last_ip: string | null
  user_agent: string | null
  is_active: boolean
  is_trusted: boolean
  last_login_at: string | null
  last_activity_at: string | null
  created_at: string
  updated_at: string
}

export interface DevicesResponse {
  success: boolean
  devices: Device[]
}

export interface DeviceResponse {
  success: boolean
  device: Device
}

export interface UpdateDeviceRequest {
  device_name?: string
}

export interface DeviceStats {
  total: number
  active: number
  trusted: number
  inactive: number
}

export interface DeviceTableItem extends Device {
  statusBadgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'
  osDisplayName: string
  lastActivityDisplay: string
  trustStatusDisplay: string
}
