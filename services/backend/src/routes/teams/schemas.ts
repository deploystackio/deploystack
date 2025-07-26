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

// Enhanced team with role info schema (includes is_admin and is_owner flags)
export const TeamWithRoleInfoSchema = TeamSchema.extend({
  role: z.enum(['team_admin', 'team_user']).describe('User role in the team'),
  is_admin: z.boolean().describe('True if user is team admin'),
  is_owner: z.boolean().describe('True if user is team owner'),
  member_count: z.number().describe('Total number of team members')
});

// Team member schemas
export const TeamMemberSchema = z.object({
  id: z.string().describe('Membership ID'),
  user_id: z.string().describe('User ID'),
  username: z.string().describe('Username'),
  email: z.string().describe('User email'),
  first_name: z.string().nullable().describe('User first name'),
  last_name: z.string().nullable().describe('User last name'),
  role: z.enum(['team_admin', 'team_user']).describe('User role in the team'),
  is_admin: z.boolean().describe('True if user is team admin'),
  is_owner: z.boolean().describe('True if user is team owner'),
  joined_at: z.date().describe('Date when user joined the team')
});

// Request schemas for team member management
export const AddTeamMemberSchema = z.object({
  email: z.string().email('Valid email address is required').describe('Email address of user to add to team'),
  role: z.enum(['team_admin', 'team_user']).describe('Role to assign to the user')
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['team_admin', 'team_user']).describe('New role for the user')
});

export const TransferOwnershipSchema = z.object({
  newOwnerId: z.string().min(1, 'New owner ID is required').describe('ID of user to transfer ownership to')
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

// Enhanced teams list response with role info
export const TeamsListWithRoleInfoResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(TeamWithRoleInfoSchema).describe('Array of teams with enhanced role information')
});

// Team members response schemas
export const TeamMembersListResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: z.array(TeamMemberSchema).describe('Array of team members with user information')
});

export const TeamMemberResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  data: TeamMemberSchema.describe('Team member data'),
  message: z.string().optional().describe('Success message')
});

// Generic success response for operations without data
export const SuccessResponseSchema = z.object({
  success: z.boolean().describe('Indicates if the operation was successful'),
  message: z.string().describe('Success message')
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
export type TeamWithRoleInfo = z.infer<typeof TeamWithRoleInfoSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type AddTeamMemberInput = z.infer<typeof AddTeamMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof TransferOwnershipSchema>;
