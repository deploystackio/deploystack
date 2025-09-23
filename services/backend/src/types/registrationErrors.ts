export interface RegistrationError {
  error: string;
  message: string;
  instructions?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any;
}

export const REGISTRATION_ERRORS = {
  TOKEN_REQUIRED: {
    error: 'registration_token_required',
    message: 'Registration token required in Authorization header',
    instructions: 'Obtain a registration token from admin interface and set Authorization: Bearer <token> header'
  },
  
  TOKEN_INVALID: {
    error: 'invalid_registration_token', 
    message: 'Invalid or malformed registration token',
    instructions: 'Generate a new registration token from the admin interface'
  },
  
  TOKEN_EXPIRED: {
    error: 'token_expired',
    message: 'Registration token has expired',
    instructions: 'Generate a new registration token with valid expiration'
  },
  
  TOKEN_USED: {
    error: 'token_already_used',
    message: 'Registration token has already been consumed',
    instructions: 'Generate a new registration token (tokens are single-use only)'
  },
  
  SCOPE_MISMATCH: {
    error: 'token_scope_mismatch',
    message: 'Registration token scope does not match registration type',
    instructions: 'Use global token for global satellites, team token for team satellites'
  },
  
  NAME_VALIDATION: {
    error: 'invalid_satellite_name',
    message: 'Satellite name does not meet validation requirements',
    instructions: '10-32 characters, lowercase letters/numbers/hyphens/underscores only'
  }
} as const;
