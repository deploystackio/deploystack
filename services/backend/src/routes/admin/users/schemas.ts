// Shared schemas for admin user management routes
// Re-exports common schemas from parent users module for consistency

export {
  // Response schemas
  ERROR_RESPONSE_SCHEMA,
  SUCCESS_MESSAGE_RESPONSE_SCHEMA,
  USERS_LIST_PAGINATED_RESPONSE_SCHEMA,

  // Request schemas
  PAGINATION_QUERY_SCHEMA,
  SEARCH_USERS_QUERY_SCHEMA,
  PARAMS_WITH_ID_SCHEMA,
  ASSIGN_ROLE_REQUEST_SCHEMA,

  // Entity schemas
  USER_SCHEMA,

  // Validation helpers
  validatePaginationParams,

  // TypeScript interfaces
  type User,
  type ErrorResponse,
  type SuccessMessageResponse,
  type PaginationQuery,
  type SearchUsersQuery,
  type PaginationMetadata,
  type ParamsWithId,
  type AssignRoleRequest,
  type UsersListPaginatedResponse
} from '../../users/schemas';

// Admin-specific response schema for user stats
export const USER_STATS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Indicates if the operation was successful'
    },
    data: {
      type: 'object',
      properties: {
        user_count_by_role: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role_id: { type: 'string', description: 'Role ID' },
              count: { type: 'number', description: 'Number of users with this role' }
            },
            required: ['role_id', 'count']
          },
          description: 'User count grouped by role'
        }
      },
      required: ['user_count_by_role']
    }
  },
  required: ['success', 'data']
} as const;

// TypeScript interface for user stats response
export interface UserStatsResponse {
  success: boolean;
  data: {
    user_count_by_role: Array<{
      role_id: string;
      count: number;
    }>;
  };
}
