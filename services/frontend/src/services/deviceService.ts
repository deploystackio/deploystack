/**
 * Device management service for DeployStack
 * Handles all device-related API operations
 */
import { getEnv } from '@/utils/env'
import type { Device, DevicesResponse, DeviceResponse, UpdateDeviceRequest } from '@/views/devices/types'

export class DeviceService {
  private static baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || 'http://localhost:3000'

  /**
   * Fetch all devices for the current user
   */
  static async getAllDevices(): Promise<Device[]> {
    const response = await fetch(`${this.baseUrl}/api/users/me/devices`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch devices: HTTP ${response.status}`)
    }
    
    const data: DevicesResponse = await response.json()
    return data.devices
  }

  /**
   * Fetch a specific device by ID
   */
  static async getDevice(deviceId: string): Promise<Device> {
    const response = await fetch(`${this.baseUrl}/api/users/me/devices/${deviceId}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Device not found')
      }
      throw new Error(`Failed to fetch device: HTTP ${response.status}`)
    }
    
    const data: DeviceResponse = await response.json()
    return data.device
  }

  /**
   * Update a device
   */
  static async updateDevice(deviceId: string, updates: UpdateDeviceRequest): Promise<Device> {
    const response = await fetch(`${this.baseUrl}/api/users/me/devices/${deviceId}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      throw new Error(`Failed to update device: HTTP ${response.status}`)
    }
    
    const data: DeviceResponse = await response.json()
    return data.device
  }

  /**
   * Remove a device
   */
  static async removeDevice(deviceId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/users/me/devices/${deviceId}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to remove device: HTTP ${response.status}`)
    }
  }
}
