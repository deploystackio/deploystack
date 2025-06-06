import { describe, it, expect } from 'vitest';
import {
  RegisterEmailSchema,
  LoginEmailSchema,
  GithubCallbackSchema,
} from '../../../../src/routes/auth/schemas';

describe('Auth Schemas', () => {
  describe('RegisterEmailSchema', () => {
    it('should validate a valid registration request', () => {
      const validRegistration = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        first_name: 'John',
        last_name: 'Doe',
      };

      const result = RegisterEmailSchema.safeParse(validRegistration);
      expect(result.success).toBe(true);
    });

    it('should validate registration without optional fields', () => {
      const validRegistration = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      };

      const result = RegisterEmailSchema.safeParse(validRegistration);
      expect(result.success).toBe(true);
    });

    it('should reject username that is too short', () => {
      const invalidRegistration = {
        username: 'ab',
        email: 'test@example.com',
        password: 'password123',
      };

      const result = RegisterEmailSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Username must be at least 3 characters long');
      }
    });

    it('should reject username that is too long', () => {
      const invalidRegistration = {
        username: 'a'.repeat(31),
        email: 'test@example.com',
        password: 'password123',
      };

      const result = RegisterEmailSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Username cannot be longer than 30 characters');
      }
    });

    it('should reject username with invalid characters', () => {
      const invalidRegistration = {
        username: 'test-user!',
        email: 'test@example.com',
        password: 'password123',
      };

      const result = RegisterEmailSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Username can only contain alphanumeric characters and underscores');
      }
    });

    it('should accept username with underscores', () => {
      const validRegistration = {
        username: 'test_user_123',
        email: 'test@example.com',
        password: 'password123',
      };

      const result = RegisterEmailSchema.safeParse(validRegistration);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidRegistration = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'password123',
      };

      const result = RegisterEmailSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Invalid email address');
      }
    });

    it('should reject password that is too short', () => {
      const invalidRegistration = {
        username: 'testuser',
        email: 'test@example.com',
        password: '1234567',
      };

      const result = RegisterEmailSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password must be at least 8 characters long');
      }
    });

    it('should reject password that is too long', () => {
      const invalidRegistration = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'a'.repeat(101),
      };

      const result = RegisterEmailSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password cannot be longer than 100 characters long');
      }
    });

    it('should reject first_name that is too long', () => {
      const invalidRegistration = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        first_name: 'a'.repeat(51),
      };

      const result = RegisterEmailSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
    });

    it('should reject last_name that is too long', () => {
      const invalidRegistration = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        last_name: 'a'.repeat(51),
      };

      const result = RegisterEmailSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
    });
  });

  describe('LoginEmailSchema', () => {
    it('should validate a valid login request with email', () => {
      const validLogin = {
        login: 'test@example.com',
        password: 'password123',
      };

      const result = LoginEmailSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('should validate a valid login request with username', () => {
      const validLogin = {
        login: 'testuser',
        password: 'password123',
      };

      const result = LoginEmailSchema.safeParse(validLogin);
      expect(result.success).toBe(true);
    });

    it('should reject empty login field', () => {
      const invalidLogin = {
        login: '',
        password: 'password123',
      };

      const result = LoginEmailSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Email or username is required');
      }
    });

    it('should reject empty password field', () => {
      const invalidLogin = {
        login: 'test@example.com',
        password: '',
      };

      const result = LoginEmailSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Password is required');
      }
    });

    it('should reject missing login field', () => {
      const invalidLogin = {
        password: 'password123',
      };

      const result = LoginEmailSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });

    it('should reject missing password field', () => {
      const invalidLogin = {
        login: 'test@example.com',
      };

      const result = LoginEmailSchema.safeParse(invalidLogin);
      expect(result.success).toBe(false);
    });
  });

  describe('GithubCallbackSchema', () => {
    it('should validate a valid GitHub callback request', () => {
      const validCallback = {
        code: 'github_auth_code_123',
        state: 'random_state_string',
      };

      const result = GithubCallbackSchema.safeParse(validCallback);
      expect(result.success).toBe(true);
    });

    it('should reject missing code field', () => {
      const invalidCallback = {
        state: 'random_state_string',
      };

      const result = GithubCallbackSchema.safeParse(invalidCallback);
      expect(result.success).toBe(false);
    });

    it('should reject missing state field', () => {
      const invalidCallback = {
        code: 'github_auth_code_123',
      };

      const result = GithubCallbackSchema.safeParse(invalidCallback);
      expect(result.success).toBe(false);
    });

    it('should accept empty code field (GitHub schema allows empty strings)', () => {
      const validCallback = {
        code: '',
        state: 'random_state_string',
      };

      const result = GithubCallbackSchema.safeParse(validCallback);
      expect(result.success).toBe(true);
    });

    it('should accept empty state field (GitHub schema allows empty strings)', () => {
      const validCallback = {
        code: 'github_auth_code_123',
        state: '',
      };

      const result = GithubCallbackSchema.safeParse(validCallback);
      expect(result.success).toBe(true);
    });
  });
});
