import { z } from 'zod';

// --- Zod schemas kept for runtime validation (safeParse in route handlers) ---

export const CreateCloudCredentialSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  comment: z.string().max(500, 'Comment must be 500 characters or less').optional(),
  credentials: z.record(z.string(), z.string()).refine(
    (data) => Object.keys(data).length > 0,
    'At least one credential field is required'
  )
});

export const UpdateCloudCredentialSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
  comment: z.string().max(500, 'Comment must be 500 characters or less').optional(),
  credentials: z.record(z.string(), z.string()).optional()
});

export const SearchCredentialsQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').describe('Search query for credential name or comment'),
  limit: z.number().min(1).max(100).default(50).optional().describe('Maximum number of results to return')
});

// Request/Response types
export type CreateCloudCredentialInput = z.infer<typeof CreateCloudCredentialSchema>;
export type UpdateCloudCredentialInput = z.infer<typeof UpdateCloudCredentialSchema>;
export type SearchCredentialsQuery = z.infer<typeof SearchCredentialsQuerySchema>;

// --- JSON Schema constants for OpenAPI response documentation ---

const ERROR_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' }
  },
  required: ['success', 'error']
} as const;

const ERROR_WITH_DETAILS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean', default: false },
    error: { type: 'string' },
    details: { type: 'array', items: { type: 'string' } }
  },
  required: ['success', 'error']
} as const;

const CREDENTIAL_FIELD_RESPONSE_OBJECT = {
  type: 'object',
  properties: {
    value: { type: 'string' },
    hasValue: { type: 'boolean' },
    secret: { type: 'boolean' }
  },
  required: ['hasValue', 'secret']
} as const;

const USER_INFO_OBJECT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    username: { type: 'string' },
    email: { type: 'string' }
  },
  required: ['id', 'username', 'email']
} as const;

const PROVIDER_OBJECT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' }
  },
  required: ['id', 'name', 'description']
} as const;

const CLOUD_CREDENTIAL_RESPONSE_OBJECT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    teamId: { type: 'string' },
    providerId: { type: 'string' },
    name: { type: 'string' },
    comment: { type: ['string', 'null'] },
    provider: PROVIDER_OBJECT,
    fields: {
      type: 'object',
      additionalProperties: CREDENTIAL_FIELD_RESPONSE_OBJECT
    },
    createdBy: {
      oneOf: [
        USER_INFO_OBJECT,
        { type: 'string' }
      ]
    },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'teamId', 'providerId', 'name', 'provider', 'createdBy', 'createdAt', 'updatedAt']
} as const;

const CLOUD_PROVIDER_OBJECT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string', enum: ['text', 'password', 'textarea'] },
          required: { type: 'boolean' },
          secret: { type: 'boolean' },
          placeholder: { type: 'string' },
          description: { type: 'string' },
          validation: {
            type: 'object',
            properties: {
              pattern: { type: 'string' },
              minLength: { type: 'number' },
              maxLength: { type: 'number' }
            }
          }
        },
        required: ['key', 'label', 'type', 'required', 'secret']
      }
    },
    enabled: { type: 'boolean' }
  },
  required: ['id', 'name', 'description', 'fields', 'enabled']
} as const;

const SEARCH_CREDENTIAL_OBJECT = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    comment: { type: ['string', 'null'] },
    providerId: { type: 'string' },
    provider: PROVIDER_OBJECT,
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' }
  },
  required: ['id', 'name', 'providerId', 'provider', 'createdAt', 'updatedAt']
} as const;

// --- Route schemas for OpenAPI documentation ---

export const listProvidersSchema = {
  tags: ['Cloud Credentials'],
  summary: 'List available cloud providers',
  description: 'Retrieves all available cloud providers with their configuration schemas.',
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'array', items: CLOUD_PROVIDER_OBJECT }
      },
      required: ['success', 'data'],
      description: 'Successfully retrieved cloud providers'
    },
    401: { ...ERROR_RESPONSE_SCHEMA, description: 'Unauthorized - Authentication required' },
    403: { ...ERROR_RESPONSE_SCHEMA, description: 'Forbidden - Insufficient permissions' },
    500: { ...ERROR_RESPONSE_SCHEMA, description: 'Internal Server Error' }
  }
};

export const listCredentialsSchema = {
  tags: ['Cloud Credentials'],
  summary: 'List team cloud credentials',
  description: 'Retrieves all cloud credentials for the specified team. Team admins see full details including field metadata, while team members see basic information only (name, provider, metadata).',
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'array', items: CLOUD_CREDENTIAL_RESPONSE_OBJECT }
      },
      required: ['success', 'data'],
      description: 'Successfully retrieved team credentials'
    },
    401: { ...ERROR_RESPONSE_SCHEMA, description: 'Unauthorized - Authentication required' },
    403: { ...ERROR_RESPONSE_SCHEMA, description: 'Forbidden - Insufficient permissions' },
    500: { ...ERROR_RESPONSE_SCHEMA, description: 'Internal Server Error' }
  }
};

export const createCredentialSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Create cloud credentials',
  description: 'Creates new cloud provider credentials for the team. Credentials are encrypted before storage.',
  security: [{ cookieAuth: [] }],
  body: {
    type: 'object',
    properties: {
      providerId: { type: 'string', minLength: 1 },
      name: { type: 'string', minLength: 1, maxLength: 100 },
      comment: { type: 'string', maxLength: 500 },
      credentials: { type: 'object', additionalProperties: { type: 'string' } }
    },
    required: ['providerId', 'name', 'credentials']
  },
  response: {
    201: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: CLOUD_CREDENTIAL_RESPONSE_OBJECT,
        message: { type: 'string' }
      },
      required: ['success', 'data', 'message'],
      description: 'Credential created successfully'
    },
    400: { ...ERROR_WITH_DETAILS_RESPONSE_SCHEMA, description: 'Bad Request - Validation error' },
    401: { ...ERROR_RESPONSE_SCHEMA, description: 'Unauthorized - Authentication required' },
    403: { ...ERROR_RESPONSE_SCHEMA, description: 'Forbidden - Insufficient permissions' },
    409: { ...ERROR_RESPONSE_SCHEMA, description: 'Conflict - Credential name already exists' },
    500: { ...ERROR_RESPONSE_SCHEMA, description: 'Internal Server Error' }
  }
};

export const getCredentialSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Get cloud credential by ID',
  description: 'Retrieves a specific cloud credential by ID. Team admins see full details including field metadata, while team members see basic information only (name, provider, metadata). Secret field values are never returned.',
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: CLOUD_CREDENTIAL_RESPONSE_OBJECT
      },
      required: ['success', 'data'],
      description: 'Credential retrieved successfully'
    },
    401: { ...ERROR_RESPONSE_SCHEMA, description: 'Unauthorized - Authentication required' },
    403: { ...ERROR_RESPONSE_SCHEMA, description: 'Forbidden - Insufficient permissions' },
    404: { ...ERROR_RESPONSE_SCHEMA, description: 'Not Found - Credential not found' },
    500: { ...ERROR_RESPONSE_SCHEMA, description: 'Internal Server Error' }
  }
};

export const updateCredentialSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Update cloud credentials',
  description: 'Updates existing cloud credentials. Secret fields can only be replaced, not retrieved.',
  security: [{ cookieAuth: [] }],
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      comment: { type: 'string', maxLength: 500 },
      credentials: { type: 'object', additionalProperties: { type: 'string' } }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: CLOUD_CREDENTIAL_RESPONSE_OBJECT,
        message: { type: 'string' }
      },
      required: ['success', 'data', 'message'],
      description: 'Credential updated successfully'
    },
    400: { ...ERROR_WITH_DETAILS_RESPONSE_SCHEMA, description: 'Bad Request - Validation error' },
    401: { ...ERROR_RESPONSE_SCHEMA, description: 'Unauthorized - Authentication required' },
    403: { ...ERROR_RESPONSE_SCHEMA, description: 'Forbidden - Insufficient permissions' },
    404: { ...ERROR_RESPONSE_SCHEMA, description: 'Not Found - Credential not found' },
    409: { ...ERROR_RESPONSE_SCHEMA, description: 'Conflict - Credential name already exists' },
    500: { ...ERROR_RESPONSE_SCHEMA, description: 'Internal Server Error' }
  }
};

export const deleteCredentialSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Delete cloud credentials',
  description: 'Deletes cloud credentials from the team. This action cannot be undone.',
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      },
      required: ['success', 'message'],
      description: 'Credential deleted successfully'
    },
    401: { ...ERROR_RESPONSE_SCHEMA, description: 'Unauthorized - Authentication required' },
    403: { ...ERROR_RESPONSE_SCHEMA, description: 'Forbidden - Insufficient permissions' },
    404: { ...ERROR_RESPONSE_SCHEMA, description: 'Not Found - Credential not found' },
    500: { ...ERROR_RESPONSE_SCHEMA, description: 'Internal Server Error' }
  }
};

export const searchCredentialsSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Search team cloud credentials',
  description: 'Search for cloud credentials within a team by name or comment. Returns only metadata, no secret values. Team membership is required.',
  security: [{ cookieAuth: [] }],
  querystring: {
    type: 'object',
    properties: {
      q: { type: 'string', minLength: 1 },
      limit: { type: 'number', minimum: 1, maximum: 100, default: 50 }
    },
    required: ['q']
  },
  response: {
    200: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'array', items: SEARCH_CREDENTIAL_OBJECT }
      },
      required: ['success', 'data'],
      description: 'Search completed successfully'
    },
    400: { ...ERROR_WITH_DETAILS_RESPONSE_SCHEMA, description: 'Bad Request - Validation error' },
    401: { ...ERROR_RESPONSE_SCHEMA, description: 'Unauthorized - Authentication required' },
    403: { ...ERROR_RESPONSE_SCHEMA, description: 'Forbidden - Insufficient permissions' },
    500: { ...ERROR_RESPONSE_SCHEMA, description: 'Internal Server Error' }
  }
};
