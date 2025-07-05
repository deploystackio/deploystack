import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Cloud provider schemas
export const CloudProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  fields: z.array(z.object({
    key: z.string(),
    label: z.string(),
    type: z.enum(['text', 'password', 'textarea']),
    required: z.boolean(),
    secret: z.boolean(),
    placeholder: z.string().optional(),
    description: z.string().optional(),
    validation: z.object({
      pattern: z.string().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
    }).optional(),
  })),
  enabled: z.boolean(),
});

export const CredentialFieldResponseSchema = z.object({
  value: z.string().optional(),
  hasValue: z.boolean(),
  secret: z.boolean(),
});

export const CloudCredentialResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  providerId: z.string(),
  name: z.string(),
  comment: z.string().nullable(),
  provider: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  fields: z.record(CredentialFieldResponseSchema),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CloudCredentialBasicResponseSchema = z.object({
  id: z.string(),
  teamId: z.string(),
  providerId: z.string(),
  name: z.string(),
  comment: z.string().nullable(),
  provider: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateCloudCredentialSchema = z.object({
  providerId: z.string().min(1, 'Provider ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  comment: z.string().max(500, 'Comment must be 500 characters or less').optional(),
  credentials: z.record(z.string()).refine(
    (data) => Object.keys(data).length > 0,
    'At least one credential field is required'
  ),
});

export const UpdateCloudCredentialSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
  comment: z.string().max(500, 'Comment must be 500 characters or less').optional(),
  credentials: z.record(z.string()).optional(),
});

export const SearchCredentialsQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').describe('Search query for credential name or comment'),
  limit: z.number().min(1).max(100).default(50).optional().describe('Maximum number of results to return'),
});

export const SearchCredentialsResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  comment: z.string().nullable(),
  providerId: z.string(),
  provider: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Request/Response types
export type CreateCloudCredentialInput = z.infer<typeof CreateCloudCredentialSchema>;
export type UpdateCloudCredentialInput = z.infer<typeof UpdateCloudCredentialSchema>;
export type SearchCredentialsQuery = z.infer<typeof SearchCredentialsQuerySchema>;

// Route schemas for OpenAPI documentation
export const listProvidersSchema = {
  tags: ['Cloud Credentials'],
  summary: 'List available cloud providers',
  description: 'Retrieves all available cloud providers with their configuration schemas.',
  security: [{ cookieAuth: [] }],
  response: {
    200: zodToJsonSchema(z.object({
      success: z.boolean().describe('Indicates if the operation was successful'),
      data: z.array(CloudProviderSchema).describe('Array of available cloud providers'),
    }).describe('Successfully retrieved cloud providers'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    401: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Unauthorized - Authentication required'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    403: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Forbidden - Insufficient permissions'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    500: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Internal Server Error'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
  }
};

export const listCredentialsSchema = {
  tags: ['Cloud Credentials'],
  summary: 'List team cloud credentials',
  description: 'Retrieves all cloud credentials for the specified team. Team admins see full details including field metadata, while team members see basic information only (name, provider, metadata).',
  security: [{ cookieAuth: [] }],
  response: {
    200: zodToJsonSchema(z.object({
      success: z.boolean().describe('Indicates if the operation was successful'),
      data: z.array(CloudCredentialResponseSchema).describe('Array of team cloud credentials'),
    }).describe('Successfully retrieved team credentials'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    401: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Unauthorized - Authentication required'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    403: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Forbidden - Insufficient permissions'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    500: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Internal Server Error'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
  }
};

export const createCredentialSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Create cloud credentials',
  description: 'Creates new cloud provider credentials for the team. Credentials are encrypted before storage.',
  security: [{ cookieAuth: [] }],
  body: zodToJsonSchema(CreateCloudCredentialSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    201: zodToJsonSchema(z.object({
      success: z.boolean().describe('Indicates if the operation was successful'),
      data: CloudCredentialResponseSchema.describe('Created credential data'),
      message: z.string().describe('Success message'),
    }).describe('Credential created successfully'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    400: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
      details: z.array(z.string()).describe('Validation error details').optional(),
    }).describe('Bad Request - Validation error'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    401: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Unauthorized - Authentication required'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    403: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Forbidden - Insufficient permissions'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    409: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Conflict - Credential name already exists'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    500: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Internal Server Error'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
  }
};

export const getCredentialSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Get cloud credential by ID',
  description: 'Retrieves a specific cloud credential by ID. Team admins see full details including field metadata, while team members see basic information only (name, provider, metadata). Secret field values are never returned.',
  security: [{ cookieAuth: [] }],
  response: {
    200: zodToJsonSchema(z.object({
      success: z.boolean().describe('Indicates if the operation was successful'),
      data: CloudCredentialResponseSchema.describe('Credential data'),
    }).describe('Credential retrieved successfully'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    401: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Unauthorized - Authentication required'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    403: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Forbidden - Insufficient permissions'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    404: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Not Found - Credential not found'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    500: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Internal Server Error'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
  }
};

export const updateCredentialSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Update cloud credentials',
  description: 'Updates existing cloud credentials. Secret fields can only be replaced, not retrieved.',
  security: [{ cookieAuth: [] }],
  body: zodToJsonSchema(UpdateCloudCredentialSchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    200: zodToJsonSchema(z.object({
      success: z.boolean().describe('Indicates if the operation was successful'),
      data: CloudCredentialResponseSchema.describe('Updated credential data'),
      message: z.string().describe('Success message'),
    }).describe('Credential updated successfully'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    400: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
      details: z.array(z.string()).describe('Validation error details').optional(),
    }).describe('Bad Request - Validation error'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    401: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Unauthorized - Authentication required'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    403: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Forbidden - Insufficient permissions'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    404: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Not Found - Credential not found'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    409: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Conflict - Credential name already exists'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    500: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Internal Server Error'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
  }
};

export const deleteCredentialSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Delete cloud credentials',
  description: 'Deletes cloud credentials from the team. This action cannot be undone.',
  security: [{ cookieAuth: [] }],
  response: {
    200: zodToJsonSchema(z.object({
      success: z.boolean().describe('Indicates if the operation was successful'),
      message: z.string().describe('Success message'),
    }).describe('Credential deleted successfully'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    401: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Unauthorized - Authentication required'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    403: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Forbidden - Insufficient permissions'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    404: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Not Found - Credential not found'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    500: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Internal Server Error'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
  }
};

export const searchCredentialsSchema = {
  tags: ['Cloud Credentials'],
  summary: 'Search team cloud credentials',
  description: 'Search for cloud credentials within a team by name or comment. Returns only metadata, no secret values. Team membership is required.',
  security: [{ cookieAuth: [] }],
  querystring: zodToJsonSchema(SearchCredentialsQuerySchema, { 
    $refStrategy: 'none', 
    target: 'openApi3' 
  }),
  response: {
    200: zodToJsonSchema(z.object({
      success: z.boolean().describe('Indicates if the operation was successful'),
      data: z.array(SearchCredentialsResponseSchema).describe('Array of matching credentials (metadata only, no secret values)'),
    }).describe('Search completed successfully'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    401: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Unauthorized - Authentication required'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    403: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Forbidden - Insufficient permissions'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
    500: zodToJsonSchema(z.object({
      success: z.boolean().default(false).describe('Indicates if the operation was successful (false for errors)'),
      error: z.string().describe('Error message'),
    }).describe('Internal Server Error'), { 
      $refStrategy: 'none', 
      target: 'openApi3' 
    }),
  }
};
