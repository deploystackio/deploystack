// Shared schemas for satellite registration token operations
// This eliminates duplication across multiple route files

// Request Schemas
export const GENERATE_GLOBAL_TOKEN_SCHEMA = {
  type: 'object',
  properties: {
    expires_in_hours: { 
      type: 'number', 
      minimum: 1, 
      maximum: 24,
      description: 'Token expiration in hours (max 24 hours for security)'
    }
  },
  additionalProperties: false
} as const;

export const GENERATE_TEAM_TOKEN_SCHEMA = {
  type: 'object',
  properties: {
    expires_in_hours: { 
      type: 'number', 
      minimum: 1, 
      maximum: 72,
      description: 'Token expiration in hours (max 72 hours for team tokens)'
    }
  },
  additionalProperties: false
} as const;

// Response Schemas
export const GLOBAL_TOKEN_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        token: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            token: { type: 'string', description: 'Complete token with prefix (deploystack_satellite_global_...)' },
            token_type: { type: 'string', enum: ['global'] },
            team_id: { type: 'null' },
            created_by: { type: 'string' },
            expires_at: { type: 'string', format: 'date-time', description: 'ISO timestamp when token expires' },
            created_at: { type: 'string', format: 'date-time' },
            used: { type: 'boolean' }
          },
          required: ['id', 'token', 'token_type', 'team_id', 'created_by', 'expires_at', 'created_at', 'used']
        }
      },
      required: ['token']
    },
    instructions: { type: 'string', description: 'Instructions for using the token' }
  },
  required: ['success', 'data', 'instructions']
} as const;

export const TEAM_TOKEN_SUCCESS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    data: {
      type: 'object',
      properties: {
        token: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            token: { type: 'string', description: 'Complete token with prefix (deploystack_satellite_team_...)' },
            token_type: { type: 'string', enum: ['team'] },
            team_id: { type: 'string', description: 'Team ID this token is scoped to' },
            created_by: { type: 'string' },
            expires_at: { type: 'string', format: 'date-time', description: 'ISO timestamp when token expires' },
            created_at: { type: 'string', format: 'date-time' },
            used: { type: 'boolean' }
          },
          required: ['id', 'token', 'token_type', 'team_id', 'created_by', 'expires_at', 'created_at', 'used']
        }
      },
      required: ['token']
    },
    instructions: { type: 'string', description: 'Instructions for using the token' }
  },
  required: ['success', 'data', 'instructions']
} as const;

export const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

export const TOKEN_LIST_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    tokens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          token_type: { type: 'string', enum: ['global', 'team'] },
          team_id: { type: 'string', nullable: true },
          created_by: { type: 'string' },
          expires_at: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
          used: { type: 'boolean' }
        },
        required: ['id', 'token_type', 'team_id', 'created_by', 'expires_at', 'created_at', 'used']
      }
    }
  },
  required: ['tokens']
} as const;

// TypeScript Interfaces
export interface GenerateTokenRequest {
  expires_in_hours?: number;
}

export interface TeamRouteParams {
  teamId: string;
}

export interface TokenRouteParams {
  tokenId: string;
}

export interface GlobalTokenSuccessResponse {
  success: boolean;
  data: {
    token: {
      id: string;
      token: string;
      token_type: 'global';
      team_id: null;
      created_by: string;
      expires_at: string;
      created_at: string;
      used: boolean;
    };
  };
  instructions: string;
}

export interface TeamTokenSuccessResponse {
  success: boolean;
  data: {
    token: {
      id: string;
      token: string;
      token_type: 'team';
      team_id: string;
      created_by: string;
      expires_at: string;
      created_at: string;
      used: boolean;
    };
  };
  instructions: string;
}

export interface ErrorResponse {
  success: boolean;
  error: string;
}
