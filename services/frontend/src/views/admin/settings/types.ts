// Settings-related TypeScript types
export interface Setting {
  key: string
  value?: string | number | boolean
  type: 'string' | 'number' | 'boolean'
  description?: string
  is_encrypted?: boolean
  group_id?: string
}

export interface GlobalSettingGroup {
  id: string
  name: string
  description?: string
  icon?: string
  sort_order?: number
  settings?: Setting[]
}

export interface SettingsUpdateRequest {
  settings: Array<{
    key: string
    value: string | number | boolean
    type?: string
    group_id?: string
    description?: string
    encrypted?: boolean
  }>
}

export interface SettingsResponse {
  success: boolean
  message?: string
  data?: Setting[]
}

export interface ConnectionTestResult {
  success: boolean
  message: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: Record<string, any>
}
