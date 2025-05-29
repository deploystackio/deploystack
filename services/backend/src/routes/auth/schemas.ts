import { z } from 'zod';

export const RegisterEmailSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters long' })
    .max(30, { message: 'Username cannot be longer than 30 characters' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain alphanumeric characters and underscores' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters long' })
    .max(100, { message: 'Password cannot be longer than 100 characters long'}), // Max length for practical reasons
  first_name: z.string().max(50).optional(),
  last_name: z.string().max(50).optional(),
});

export type RegisterEmailInput = z.infer<typeof RegisterEmailSchema>;

export const LoginEmailSchema = z.object({
  // User can login with either email or username
  login: z.string().min(1, { message: 'Email or username is required' }), // Combined field for email or username
  password: z.string().min(1, { message: 'Password is required' }),
});

export type LoginEmailInput = z.infer<typeof LoginEmailSchema>;

// Schema for GitHub OAuth callback query parameters (example)
export const GithubCallbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

export type GithubCallbackInput = z.infer<typeof GithubCallbackSchema>;
