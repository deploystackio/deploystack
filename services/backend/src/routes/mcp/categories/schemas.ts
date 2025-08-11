// Shared schemas and interfaces for MCP Categories module
// This file contains common schemas used across multiple category endpoints
// to eliminate duplication and ensure consistency

// Core category object schema - used in responses across multiple endpoints
export const CATEGORY_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      description: 'Unique identifier of the category'
    },
    name: {
      type: 'string',
      description: 'Name of the category'
    },
    description: {
      type: 'string',
      nullable: true,
      description: 'Description of the category'
    },
    icon: {
      type: 'string',
      nullable: true,
      description: 'Icon identifier for the category'
    },
    sort_order: {
      type: 'number',
      description: 'Sort order for display'
    },
    created_at: {
      type: 'string',
      format: 'date-time',
      description: 'ISO timestamp when the category was created'
    }
  },
  required: ['id', 'name', 'description', 'icon', 'sort_order', 'created_at']
} as const;

// Standard error response schema - used by all category endpoints
export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      default: false,
      description: 'Indicates the operation failed'
    },
    error: {
      type: 'string',
      description: 'Error message describing what went wrong'
    }
  },
  required: ['success', 'error']
} as const;

// Category ID parameter schema - used by DELETE and UPDATE endpoints
export const CATEGORY_ID_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      minLength: 1,
      description: 'Unique identifier of the category'
    }
  },
  required: ['id'],
  additionalProperties: false
} as const;

// Shared TypeScript interfaces

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

export interface CategoryIdParams {
  id: string;
}
