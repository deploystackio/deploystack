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
  aws: {
    id: 'aws',
    name: 'Amazon Web Services',
    description: 'Deploy applications and services on AWS',
    enabled: true,
    fields: [
      {
        key: 'access_key_id',
        label: 'Access Key ID',
        type: 'text',
        required: true,
        secret: false,
        placeholder: 'AKIAIOSFODNN7EXAMPLE',
        description: 'Your AWS Access Key ID',
        validation: {
          minLength: 16,
          maxLength: 128,
          pattern: '^AKIA[0-9A-Z]{12,}$'
        }
      },
      {
        key: 'secret_access_key',
        label: 'Secret Access Key',
        type: 'password',
        required: true,
        secret: true,
        placeholder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        description: 'Your AWS Secret Access Key',
        validation: {
          minLength: 40,
          maxLength: 128
        }
      }
    ]
  },
  render: {
    id: 'render',
    name: 'Render.com',
    description: 'Deploy applications and services on Render',
    enabled: true,
    fields: [
      {
        key: 'api_key',
        label: 'API Key',
        type: 'password',
        required: true,
        secret: true,
        placeholder: 'rnd_xxxxxxxxxxxxxxxxxx',
        description: 'Your Render API key from Account Settings',
        validation: {
          minLength: 20,
          pattern: '^rnd_[a-zA-Z0-9]+$'
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
