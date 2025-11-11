// Shared schemas for gateway configuration endpoints

// Client information with icons
export interface ClientInfo {
  id: string;
  name: string;
  iconPath: string;
}

// Supported MCP client types with icon paths
export const CLIENT_TYPES: readonly ClientInfo[] = [
  { id: 'claude-desktop', name: 'Claude Desktop', iconPath: '/images/provider/claude.svg' },
  { id: 'vscode', name: 'VS Code', iconPath: '/images/provider/vscode.svg' },
  { id: 'claude-code', name: 'Claude Code', iconPath: '/images/provider/claude.svg' },
] as const;

// Extract client IDs for validation
export const CLIENT_IDS = CLIENT_TYPES.map(client => client.id);

export type ClientType = typeof CLIENT_IDS[number];

// Reusable Schema Constants
export const CLIENT_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    client: {
      type: 'string',
      enum: CLIENT_IDS,
      description: 'The MCP client type'
    }
  },
  required: ['client'],
  additionalProperties: false
} as const;

// New response schema for array-based configuration with actions
export const SUCCESS_RESPONSE_SCHEMA = {
  type: 'array',
  description: 'Array of configuration actions for the client',
  items: {
    oneOf: [
      {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['json'] },
          mcpServers: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string' },
                transport: { type: 'string' },
                type: { type: 'string' }
              },
              additionalProperties: true
            }
          }
        },
        required: ['type', 'mcpServers'],
        additionalProperties: false
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['link'] },
          url: { type: 'string', format: 'uri' },
          name: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['type', 'url'],
        additionalProperties: false
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['text'] },
          content: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['type', 'content'],
        additionalProperties: false
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['command'] },
          command: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['type', 'command'],
        additionalProperties: false
      }
    ]
  }
} as const;

export const CLIENTS_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    clients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          iconPath: { type: 'string' }
        },
        required: ['id', 'name', 'iconPath'],
        additionalProperties: false
      },
      description: 'List of supported MCP client types with metadata'
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
  clients: readonly ClientInfo[];
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

// New interfaces for action-based configuration
export interface JsonAction {
  type: 'json';
  mcpServers?: {
    [key: string]: {
      url?: string;
      name?: string;
      description?: string;
      transport?: string;
      type?: string;
      env?: { [key: string]: string };
      [key: string]: unknown;
    };
  };
  // VS Code specific format
  inputs?: Array<{
    type: string;
    id: string;
    description: string;
    password?: boolean;
  }>;
  servers?: {
    [key: string]: {
      type: string;
      url?: string;
      command?: string;
      args?: string[];
      env?: { [key: string]: string };
      headers?: { [key: string]: string };
      auth?: {
        type: string;
        flow?: string;
        scopes?: string[];
      };
      [key: string]: unknown;
    };
  };
}

export interface LinkAction {
  type: 'link';
  url: string;
  name?: string;
  description?: string;
}

export interface TextAction {
  type: 'text';
  content: string;
  title?: string;
  description?: string;
}

export interface CommandAction {
  type: 'command';
  command: string;
  title?: string;
  description?: string;
}

export type ConfigAction = JsonAction | LinkAction | TextAction | CommandAction;
export type ClientConfigResponse = ConfigAction[];
