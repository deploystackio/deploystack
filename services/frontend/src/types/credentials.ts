export interface CloudProvider {
  id: string
  name: string
  description: string
  fields: CredentialField[]
  enabled: boolean
}

export interface CredentialField {
  key: string
  label: string
  type: 'text' | 'password' | 'textarea'
  required: boolean
  secret: boolean
  placeholder?: string
  description?: string
  validation?: {
    pattern?: string
    minLength?: number
    maxLength?: number
  }
}

export interface CloudCredential {
  id: string
  teamId: string
  providerId: string
  name: string
  comment?: string | null
  provider: {
    id: string
    name: string
    description: string
  }
  fields?: Record<string, {
    hasValue: boolean
    secret: boolean
    value?: string // Only for non-secret fields for team_admin
  }>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CloudCredentialBasic {
  id: string
  teamId: string
  providerId: string
  name: string
  comment?: string | null
  provider: {
    id: string
    name: string
    description: string
  }
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateCredentialInput {
  providerId: string
  name: string
  comment?: string
  credentials: Record<string, string>
}

export interface UpdateCredentialInput {
  name?: string
  comment?: string
  credentials?: Record<string, string>
}

// API Response types
export interface CloudProvidersResponse {
  success: boolean
  data: CloudProvider[]
}

export interface CloudCredentialsResponse {
  success: boolean
  data: CloudCredential[]
}

export interface CloudCredentialResponse {
  success: boolean
  data: CloudCredential
  message?: string
}

export interface SearchCredentialsResponse {
  success: boolean
  data: CloudCredentialBasic[]
}

export interface ApiError {
  success: false
  error: string
  details?: string[]
}

// Form validation types
export interface CredentialFormData {
  providerId: string
  name: string
  comment: string
  credentials: Record<string, string>
}

export interface FieldError {
  field: string
  message: string
}

export interface ValidationResult {
  valid: boolean
  errors: FieldError[]
}

// Event bus types for credentials
export interface CredentialEvents {
  'credentials-updated': void
  'credential-created': { credentialId: string; credentialName: string }
  'credential-deleted': { credentialId: string; credentialName: string }
}
