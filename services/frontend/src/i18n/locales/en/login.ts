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
    rememberMe: 'Remember me',
    forgotPassword: 'Forgot password?',
  },
  buttons: {
    submit: 'Sign in',
    loading: 'Signing in...',
  },
  noAccount: 'Not a member?',
  createAccount: 'Create an account',
  errors: {
    title: 'Error',
    invalidCredentials: 'Invalid email or password',
    networkError: 'Unable to connect to server. Please check your connection and try again.',
    serverError: 'Server error occurred. Please try again later.',
    unknownError: 'An unexpected error occurred. Please try again.',
    timeout: 'Request timed out. Please try again.',
  },
}
