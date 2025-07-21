export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea';
  required: boolean;
  secret: boolean;
  placeholder?: string;
  description?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
  };
}

export interface CloudProvider {
  id: string;
  name: string;
  description: string;
  fields: CredentialField[];
  enabled: boolean;
}

export const CLOUD_PROVIDERS: Record<string, CloudProvider> = {
  gcp: {
    id: 'gcp',
    name: 'Google Cloud Platform',
    description: 'Deploy applications and services on Google Cloud',
    enabled: true,
    fields: [
      {
        key: 'service_account_key',
        label: 'Service Account Key (JSON)',
        type: 'textarea',
        required: true,
        secret: true,
        placeholder: '{\n  "type": "service_account",\n  "project_id": "your-project-id",\n  "private_key_id": "...",\n  "private_key": "...",\n  "client_email": "...",\n  "client_id": "...",\n  "auth_uri": "...",\n  "token_uri": "...",\n  "auth_provider_x509_cert_url": "...",\n  "client_x509_cert_url": "..."\n}',
        description: 'Your Google Cloud Service Account JSON key file contents',
        validation: {
          minLength: 100
        }
      },
      {
        key: 'project_id',
        label: 'Project ID',
        type: 'text',
        required: true,
        secret: false,
        placeholder: 'my-gcp-project-123',
        description: 'Your Google Cloud Project ID',
        validation: {
          minLength: 6,
          maxLength: 63,
          pattern: '^[a-z][a-z0-9-]{4,61}[a-z0-9]$'
        }
      }
    ]
  }
};

export const getCloudProvider = (providerId: string): CloudProvider | null => {
  return CLOUD_PROVIDERS[providerId] || null;
};

export const getEnabledCloudProviders = (): CloudProvider[] => {
  return Object.values(CLOUD_PROVIDERS).filter(provider => provider.enabled);
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const validateCredentialData = (providerId: string, data: Record<string, any>): { valid: boolean; errors: string[] } => {
  const provider = getCloudProvider(providerId);
  if (!provider) {
    return { valid: false, errors: ['Invalid provider ID'] };
  }

  // Handle null or undefined data
  if (!data || typeof data !== 'object') {
    data = {};
  }

  const errors: string[] = [];

  // Check required fields
  for (const field of provider.fields) {
    const value = data[field.key];
    
    // Check if required field is missing or empty
    if (field.required) {
      if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
        errors.push(`${field.label} is required`);
        continue;
      }
    }

    // Only validate if value exists and is a string
    if (value && typeof value === 'string' && field.validation) {
      // Check minimum length
      if (field.validation.minLength && value.length < field.validation.minLength) {
        errors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
      }

      // Check maximum length
      if (field.validation.maxLength && value.length > field.validation.maxLength) {
        errors.push(`${field.label} must be no more than ${field.validation.maxLength} characters`);
      }

      // Check pattern
      if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
        errors.push(`${field.label} format is invalid`);
      }
    } else if (value && typeof value !== 'string' && field.required) {
      // If value exists but is not a string and field is required, it's invalid
      errors.push(`${field.label} must be a valid string`);
    }
  }

  return { valid: errors.length === 0, errors };
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const validateCredentialDataForUpdate = (providerId: string, data: Record<string, any>): { valid: boolean; errors: string[] } => {
  const provider = getCloudProvider(providerId);
  if (!provider) {
    return { valid: false, errors: ['Invalid provider ID'] };
  }

  // Handle null or undefined data
  if (!data || typeof data !== 'object') {
    data = {};
  }

  const errors: string[] = [];

  // For updates, only validate fields that are actually provided
  for (const field of provider.fields) {
    const value = data[field.key];
    
    // Skip validation if field is not provided (undefined or null)
    if (value === null || value === undefined) {
      continue;
    }

    // If field is provided, validate it
    if (typeof value === 'string') {
      // Check if empty string for required fields
      if (field.required && value.trim() === '') {
        errors.push(`${field.label} cannot be empty`);
        continue;
      }

      // Validate format if field has validation rules
      if (field.validation) {
        // Check minimum length
        if (field.validation.minLength && value.length < field.validation.minLength) {
          errors.push(`${field.label} must be at least ${field.validation.minLength} characters`);
        }

        // Check maximum length
        if (field.validation.maxLength && value.length > field.validation.maxLength) {
          errors.push(`${field.label} must be no more than ${field.validation.maxLength} characters`);
        }

        // Check pattern
        if (field.validation.pattern && !new RegExp(field.validation.pattern).test(value)) {
          errors.push(`${field.label} format is invalid`);
        }
      }
    } else {
      // If value exists but is not a string, it's invalid
      errors.push(`${field.label} must be a valid string`);
    }
  }

  return { valid: errors.length === 0, errors };
};
