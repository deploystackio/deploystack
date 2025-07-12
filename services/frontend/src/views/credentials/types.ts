// Re-export credential types for local use
export type {
  CloudProvider,
  CredentialField,
  UserInfo,
  CloudCredential,
  CloudCredentialBasic,
  CreateCredentialInput,
  UpdateCredentialInput,
  CloudProvidersResponse,
  CloudCredentialsResponse,
  CloudCredentialResponse,
  SearchCredentialsResponse,
  ApiError,
  CredentialFormData,
  FieldError,
  ValidationResult,
  CredentialEvents
} from '@/types/credentials'

// Import types for local use
import type { CloudCredential, CloudCredentialBasic } from '@/types/credentials'

// Local types specific to credentials views
export interface CredentialTableProps {
  credentials: CloudCredential[] | CloudCredentialBasic[]
  onManage: (credentialId: string) => void
}

export interface CredentialFilters {
  provider?: string
  status?: 'active' | 'inactive'
  search?: string
}

export interface CredentialTableColumn {
  key: string
  label: string
  sortable?: boolean
  width?: string
}
