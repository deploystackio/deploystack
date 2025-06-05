import { z } from 'zod';

// Base schema for global setting
export const GlobalSettingSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._-]+$/, 'Key can only contain letters, numbers, dots, underscores, and hyphens'),
  value: z.string(),
  type: z.enum(['string', 'number', 'boolean']),
  description: z.string().optional(),
  is_encrypted: z.boolean(),
  group_id: z.string().optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

// Schema for creating a new global setting
export const CreateGlobalSettingSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._-]+$/, 'Key can only contain letters, numbers, dots, underscores, and hyphens'),
  value: z.union([z.string(), z.number(), z.boolean()]),
  type: z.enum(['string', 'number', 'boolean']),
  description: z.string().optional(),
  encrypted: z.boolean().optional().default(false),
  group_id: z.string().optional(),
}).refine(data => {
  // Validate that value matches the specified type
  switch (data.type) {
    case 'string':
      return typeof data.value === 'string';
    case 'number':
      return typeof data.value === 'number';
    case 'boolean':
      return typeof data.value === 'boolean';
    default:
      return false;
  }
}, {
  message: 'Value must match the specified type',
  path: ['value'],
});

// Schema for updating a global setting
export const UpdateGlobalSettingSchema = z.object({
  value: z.string().min(1).optional(),
  description: z.string().optional(),
  encrypted: z.boolean().optional(),
  group_id: z.string().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// Schema for bulk setting creation/update
export const BulkGlobalSettingsSchema = z.object({
  settings: z.array(CreateGlobalSettingSchema).min(1, 'At least one setting is required'),
});

// Schema for search query
export const SearchGlobalSettingsSchema = z.object({
  pattern: z.string().min(1, 'Search pattern is required'),
});

// Schema for category filter
export const CategoryFilterSchema = z.object({
  category: z.string().min(1, 'Category is required'),
});

// Type exports
export type GlobalSettingInput = z.infer<typeof GlobalSettingSchema>;
export type CreateGlobalSettingInput = z.infer<typeof CreateGlobalSettingSchema>;
export type UpdateGlobalSettingInput = z.infer<typeof UpdateGlobalSettingSchema>;
export type BulkGlobalSettingsInput = z.infer<typeof BulkGlobalSettingsSchema>;
export type SearchGlobalSettingsInput = z.infer<typeof SearchGlobalSettingsSchema>;
export type CategoryFilterInput = z.infer<typeof CategoryFilterSchema>;

// Response schemas
export const GlobalSettingResponseSchema = z.object({
  success: z.boolean(),
  data: GlobalSettingSchema.optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const GlobalSettingsListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(GlobalSettingSchema).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const CategoriesResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.string()).optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const DeleteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  error: z.string().optional(),
});

// Validation helper functions
export function validateSettingKey(key: string): boolean {
  try {
    z.string().min(1).max(255).regex(/^[a-zA-Z0-9._-]+$/, 'Key can only contain letters, numbers, dots, underscores, and hyphens').parse(key);
    return true;
  } catch {
    return false;
  }
}

export function validateSettingValue(value: string | number | boolean, type: 'string' | 'number' | 'boolean'): boolean {
  try {
    switch (type) {
      case 'string':
        return typeof value === 'string' && value.length > 0;
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return false;
    }
  } catch {
    return false;
  }
}
