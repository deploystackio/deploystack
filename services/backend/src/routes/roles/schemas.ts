import { z } from 'zod';

// Role schemas
export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  permissions: z.array(z.string()),
  is_system_role: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const CreateRoleSchema = z.object({
  id: z.string().min(1, 'Role ID is required'),
  name: z.string().min(1, 'Role name is required'),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

export const UpdateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1).optional(),
});

export const AssignRoleSchema = z.object({
  role_id: z.string().min(1, 'Role ID is required'),
});

// User management schemas
export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string(),
  auth_type: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  github_id: z.string().nullable(),
  role_id: z.string().nullable(),
  role: z.object({
    id: z.string(),
    name: z.string(),
    permissions: z.array(z.string()),
  }).optional(),
});

export const UpdateUserSchema = z.object({
  username: z.string().min(1).optional(),
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role_id: z.string().optional(),
});

// Request/Response types
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;
export type UpdateRoleInput = z.infer<typeof UpdateRoleSchema>;
export type AssignRoleInput = z.infer<typeof AssignRoleSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

// Available permissions list
export const AVAILABLE_PERMISSIONS = [
  'users.list',
  'users.view',
  'users.edit',
  'users.delete',
  'users.create',
  'roles.manage',
  'system.admin',
  'settings.view',
  'settings.edit',
  'settings.delete',
  'profile.view',
  'profile.edit',
  'teams.create',
  'teams.view',
  'teams.edit',
  'teams.delete',
  'teams.manage',
  'team.members.view',
  'team.members.manage',
] as const;

export type Permission = typeof AVAILABLE_PERMISSIONS[number];
