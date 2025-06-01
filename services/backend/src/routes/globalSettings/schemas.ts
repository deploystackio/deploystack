import { z } from 'zod';

// Base schema for global setting
export const GlobalSettingSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._-]+$/, 'Key can only contain letters, numbers, dots, underscores, and hyphens'),
  value: z.string(),
  description: z.string().optional(),
  is_encrypted: z.boolean(),
  category: z.string().optional(),
  created_at: z.date(),
  updated_at: z.date(),
});

// Schema for creating a new global setting
export const CreateGlobalSettingSchema = z.object({
  key: z.string().min(1).max(255).regex(/^[a-zA-Z0-9._-]+$/, 'Key can only contain letters, numbers, dots, underscores, and hyphens'),
  value: z.string().min(1, 'Value is required'),
  description: z.string().optional(),
  encrypted: z.boolean().optional().default(false),
  category: z.string().optional(),
});

// Schema for updating a global setting
export const UpdateGlobalSettingSchema = z.object({
  value: z.string().min(1).optional(),
  description: z.string().optional(),
  encrypted: z.boolean().optional(),
  category: z.string().optional(),
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
    CreateGlobalSettingSchema.pick({ key: true }).parse({ key });
    return true;
  } catch {
    return false;
  }
}

export function validateSettingValue(value: string): boolean {
  try {
    CreateGlobalSettingSchema.pick({ value: true }).parse({ value });
    return true;
  } catch {
    return false;
  }
}
