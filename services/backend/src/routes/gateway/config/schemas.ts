// Shared schemas for gateway configuration endpoints

// Supported MCP client types
export const CLIENT_TYPES = ['claude-desktop', 'cline', 'vscode', 'cursor', 'windsurf'] as const;

export type ClientType = typeof CLIENT_TYPES[number];

// Reusable Schema Constants
export const CLIENT_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    client: {
      type: 'string',
      enum: CLIENT_TYPES,
      description: 'The MCP client type'
    }
  },
  required: ['client'],
  additionalProperties: false
} as const;

export const SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  description: 'Client-specific gateway configuration (format varies by client type)',
  additionalProperties: true
} as const;

export const CLIENTS_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    clients: {
      type: 'array',
      items: {
        type: 'string',
        enum: CLIENT_TYPES
      },
      description: 'List of supported MCP client types'
    }
  },
  required: ['clients'],
  additionalProperties: false
} as const;

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

// TypeScript interfaces
export interface ClientParams {
  client: ClientType;
}

export interface ClientsListResponse {
  clients: readonly string[];
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}
