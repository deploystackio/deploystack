export interface ProfileFormData {
  first_name: string
  last_name: string
  username: string
  email: string
}

export interface SecurityFormData {
  current_password: string
  new_password: string
  confirm_password: string
}

export interface UserAccountProps {
  canChangeUsername: boolean
  canChangePassword: boolean
  authTypeDisplayName: string
  providerName: string
  settingsLocation: string
}
