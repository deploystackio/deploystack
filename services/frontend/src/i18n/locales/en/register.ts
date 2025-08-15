export default {
  title: 'Create an account',
  form: {
    name: {
      label: 'Username',
      placeholder: 'Enter username (letters, numbers, underscores, dots, hyphens only)',
    },
    email: {
      label: 'Email address',
      placeholder: 'Enter your email address',
    },
    password: {
      label: 'Password',
      placeholder: 'Create a password',
    },
    confirmPassword: {
      label: 'Confirm password',
      placeholder: 'Confirm your password',
    },
  },
  buttons: {
    submit: 'Create account',
    loading: 'Creating account...',
  },
  haveAccount: 'Already have an account?',
  signIn: 'Sign in',
  termsAgreement: 'By creating an account, you agree to our Terms of Service and Privacy Policy',
  success: {
    title: 'Account created successfully!',
    description: 'You can now sign in with your credentials.'
  },
  errors: {
    title: 'Registration Error',
    networkError: 'Unable to connect to server. Please try again later.',
    conflict: 'Username or email already exists.',
    serverError: 'Server error occurred. Please try again later.',
    timeout: 'Request timed out. Please try again.',
    unknownError: 'An unexpected error occurred during registration.'
  }
}
