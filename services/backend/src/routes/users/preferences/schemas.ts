// Shared schemas for user preferences API endpoints
// Auto-generated from config to avoid duplication

import { DEFAULT_USER_PREFERENCES, type PreferenceValue } from '../../../config/user-preferences';

// Helper function to generate schema properties from config
function generateSchemaProperties() {
  const properties: Record<string, any> = {};
  
  for (const [key, defaultValue] of Object.entries(DEFAULT_USER_PREFERENCES)) {
    const valueType = typeof defaultValue;
    
    if (valueType === 'boolean') {
      properties[key] = { type: 'boolean' };
    } else if (valueType === 'string') {
      properties[key] = { type: 'string' };
    } else if (valueType === 'number') {
      properties[key] = { type: 'number' };
    }
  }
  
  return properties;
}

// Auto-generated User Preferences Schema from config
export const USER_PREFERENCES_SCHEMA = {
  type: 'object',
  properties: generateSchemaProperties(),
  additionalProperties: false // Only allow defined preference keys
} as const;

// Auto-generated Request Schema from config
export const UPDATE_PREFERENCES_REQUEST_SCHEMA = {
  type: 'object',
  properties: generateSchemaProperties(),
  additionalProperties: false,
  minProperties: 1 // At least one preference must be provided
} as const;

export const SET_PREFERENCE_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    value: {
      oneOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' }
      ],
      description: 'The preference value to set (string, number, or boolean)'
    }
  },
  required: ['value'],
  additionalProperties: false
} as const;

export const ACKNOWLEDGE_NOTIFICATION_REQUEST_SCHEMA = {
  type: 'object',
  properties: {
    notification_id: { 
      type: 'string', 
      minLength: 1,
      description: 'ID of the notification to acknowledge' 
    }
  },
  required: ['notification_id'],
  additionalProperties: false
} as const;

// Success Response Schemas
export const PREFERENCES_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    preferences: USER_PREFERENCES_SCHEMA
  },
  required: ['success', 'preferences']
} as const;

export const PREFERENCE_VALUE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    value: {
      oneOf: [
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' }
      ],
      description: 'The preference value'
    }
  },
  required: ['success', 'value']
} as const;

export const WALKTHROUGH_STATUS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    should_show_walkthrough: { 
      type: 'boolean', 
      description: 'Whether the user should see the walkthrough' 
    }
  },
  required: ['success', 'should_show_walkthrough']
} as const;

export const SIMPLE_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: true },
    message: { type: 'string' }
  },
  required: ['success', 'message']
} as const;

// Error Response Schema
export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// TypeScript Interfaces - Auto-generated from config
export interface UserPreferences {
  [key: string]: PreferenceValue;
}

// Auto-generated interface from config - all properties are optional for updates
export type UpdatePreferencesRequest = Partial<typeof DEFAULT_USER_PREFERENCES>;

export interface SetPreferenceRequest {
  value: PreferenceValue;
}

export interface AcknowledgeNotificationRequest {
  notification_id: string;
}

export interface PreferencesSuccessResponse {
  success: boolean;
  preferences: UserPreferences;
}

export interface PreferenceValueResponse {
  success: boolean;
  value: PreferenceValue;
}

export interface WalkthroughStatusResponse {
  success: boolean;
  should_show_walkthrough: boolean;
}

export interface SimpleSuccessResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}
