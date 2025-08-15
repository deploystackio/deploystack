export default {
  title: 'Sign in to your account',
  form: {
    email: {
      label: 'Email address',
      placeholder: 'Enter your email address',
    },
    password: {
      label: 'Password',
      placeholder: 'Enter your password',
    },
    forgotPassword: 'Forgot password?',
  },
  buttons: {
    submit: 'Sign in',
    loading: 'Signing in...',
  },
  noAccount: "Don't have an account?",
  createAccount: 'Create account',
  oauth: {
    divider: 'or',
    github: {
      button: 'Continue with GitHub',
      signup: 'Sign up with GitHub',
      unavailable: 'GitHub login is currently unavailable'
    }
  },
  errors: {
    title: 'Sign In Error',
    networkError: 'Unable to connect to server. Please check your connection or try again later.',
    invalidCredentials: 'Invalid email or password.',
    serverError: 'Server error occurred. Please try again later.',
    timeout: 'Request timed out. Please try again.',
    unknownError: 'An unexpected error occurred during sign in.',
    githubOAuthError: 'GitHub sign in failed. Please try again.'
  }
}
