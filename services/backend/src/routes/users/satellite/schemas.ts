// Shared schemas for gateway configuration endpoints

// Client information with icons and metadata
export interface ClientInfo {
  id: string;
  name: string;
  iconPath: string;
  description?: string;
}

// Category information
export interface ClientCategory {
  id: string;
  name: string;
  description: string;
  clients: readonly ClientInfo[];
}

// Supported MCP client types with icon paths and metadata
export const CLIENT_TYPES: readonly ClientInfo[] = [
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    iconPath: '/images/provider/claude.svg',
    description: 'Configure MCP client settings and parameters'
  },
  {
    id: 'vscode',
    name: 'VS Code',
    iconPath: '/images/provider/vscode.svg',
    description: 'Configure MCP client settings and parameters'
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    iconPath: '/images/provider/claude.svg',
    description: 'Configure MCP client settings and parameters'
  },
  {
    id: 'cursor',
    name: 'Cursor',
    iconPath: '/images/provider/cursor.svg',
    description: 'Configure MCP client settings and parameters'
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    iconPath: '/images/provider/gemini.svg',
    description: 'Configure MCP client settings and parameters'
  },
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

export const CLIENT_CATEGORY_PARAM_SCHEMA = {
  type: 'object',
  properties: {
    category: {
      type: 'string',
      description: 'The configuration category (e.g., connection, ai-instructions)'
    },
    client: {
      type: 'string',
      enum: CLIENT_IDS,
      description: 'The MCP client type'
    }
  },
  required: ['category', 'client'],
  additionalProperties: false
} as const;

export const SATELLITE_ID_QUERY_SCHEMA = {
  type: 'object',
  properties: {
    satelliteId: {
      type: 'string',
      description: 'Satellite ID to generate configuration for (optional, defaults to first active satellite)'
    }
  },
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
          category: { type: 'string' },
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
          },
          inputs: { type: 'array' },
          servers: { type: 'object' },
          title: { type: 'string' },
          description: { type: 'string' },
          inputType: { type: 'string', enum: ['input', 'textarea'] }
        },
        required: ['type'],
        additionalProperties: false
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['link'] },
          category: { type: 'string' },
          url: { type: 'string', format: 'uri' },
          name: { type: 'string' },
          description: { type: 'string' },
          imageUrl: { type: 'string' },
          buttonText: { type: 'string' }
        },
        required: ['type', 'url'],
        additionalProperties: false
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['text'] },
          category: { type: 'string' },
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
          category: { type: 'string' },
          command: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          inputType: { type: 'string', enum: ['input', 'textarea'] }
        },
        required: ['type', 'command'],
        additionalProperties: false
      },
      {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['steps'] },
          category: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                required: { type: 'boolean' },
                content: { type: 'string' }
              },
              required: ['name', 'required', 'content'],
              additionalProperties: false
            }
          },
          title: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['type', 'steps'],
        additionalProperties: false
      }
    ]
  }
} as const;

export const CLIENTS_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          clients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                iconPath: { type: 'string' },
                description: { type: 'string' }
              },
              required: ['id', 'name', 'iconPath'],
              additionalProperties: false
            }
          }
        },
        required: ['id', 'name', 'description', 'clients'],
        additionalProperties: false
      },
      description: 'Categorized list of supported MCP client types'
    }
  },
  required: ['categories'],
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

export interface ClientCategoryParams {
  category: string;
  client: ClientType;
}

export interface SatelliteIdQuery {
  satelliteId?: string;
}

export interface ClientsListResponse {
  categories: readonly ClientCategory[];
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}

// New interfaces for action-based configuration
export interface JsonAction {
  type: 'json';
  category?: string;
  jsonContent?: string;
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
  title?: string;
  description?: string;
  inputType?: 'input' | 'textarea';
}

export interface LinkAction {
  type: 'link';
  category?: string;
  url: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  buttonText?: string;
}

export interface TextAction {
  type: 'text';
  category?: string;
  content: string;
  title?: string;
  description?: string;
}

export interface CommandAction {
  type: 'command';
  category?: string;
  command: string;
  title?: string;
  description?: string;
  inputType?: 'input' | 'textarea';
}

export interface Step {
  name: string;
  required: boolean;
  content: string;
}

export interface StepsAction {
  type: 'steps';
  category?: string;
  steps: Step[];
  title?: string;
  description?: string;
}

export type ConfigAction = JsonAction | LinkAction | TextAction | CommandAction | StepsAction;
export type ClientConfigResponse = ConfigAction[];
