import { z } from 'zod';

// Team creation schema
export const CreateTeamSchema = z.object({
  name: z.string()
    .min(1, 'Team name is required')
    .max(100, 'Team name must be 100 characters or less')
    .describe('Team name'),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .describe('Team description')
});

// Team update schema
export const UpdateTeamSchema = z.object({
  name: z.string()
    .min(1, 'Team name is required')
    .max(100, 'Team name must be 100 characters or less')
    .optional()
    .describe('Team name'),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .nullable()
    .optional()
    .describe('Team description')
});

// Team response schema
export const TeamSchema = z.object({
  id: z.string().describe('Team ID'),
  name: z.string().describe('Team name'),
  slug: z.string().describe('Team slug'),
  description: z.string().nullable().describe('Team description'),
  owner_id: z.string().describe('Team owner ID'),
  is_default: z.boolean().describe('Indicates if this is the user\'s default team'),
  created_at: z.date().describe('Team creation date'),
  updated_at: z.date().describe('Team last update date')
});

// Team with membership info schema
export const TeamWithMembershipSchema = TeamSchema.extend({
  role: z.enum(['team_admin', 'team_user']).describe('User role in the team')
});

// Success response schemas
export const TeamResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: TeamSchema.describe('Team data'),
  message: z.string().optional().describe('Success message')
});

export const TeamsListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(TeamWithMembershipSchema).describe('Array of teams with user roles')
});

// Error response schema
export const ErrorResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful (false for errors)').default(false),
  error: z.string().describe('Error message'),
  details: z.array(z.any()).optional().describe('Additional error details (validation errors)')
});

// Type exports
export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;
export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type TeamWithMembership = z.infer<typeof TeamWithMembershipSchema>;
