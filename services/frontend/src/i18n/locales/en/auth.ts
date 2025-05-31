// @/i18n/locales/en/auth.ts
export default {
  logout: {
    title: 'Logout',
    inProgressMessage: 'Logout in Progress... Redirecting to login.',
  },
  login: {
    title: 'Login',
    form: {
      email: {
        label: 'Email',
        placeholder: 'Enter your email',
      },
      password: {
        label: 'Password',
        placeholder: 'Enter your password',
      },
      forgotPassword: 'Forgot password?',
    },
    buttons: {
      submit: 'Login',
      // Assuming login might also have a loading state, adding for consistency
      loading: 'Logging in...',
    },
    noAccount: "Don't have an account?",
    createAccount: 'Create account',
    errors: { // Added based on Login.vue structure, using placeholders
      title: 'Login Error',
      networkError: 'Network error. Please check your connection or try again later.',
      invalidCredentials: 'Invalid email or password.',
      serverError: 'Server error. Please try again later.',
      timeout: 'The request timed out. Please try again.',
      unknownError: 'An unknown error occurred during login.'
    }
  },
  register: {
    title: 'Register',
    form: {
      name: {
        label: 'Name',
        placeholder: 'Enter your name',
      },
      email: {
        label: 'Email',
        placeholder: 'Enter your email',
      },
      password: {
        label: 'Password',
        placeholder: 'Choose a password',
      },
      confirmPassword: {
        label: 'Confirm Password',
        placeholder: 'Confirm your password',
      },
    },
    buttons: {
      submit: 'Create Account',
      loading: 'Creating Account...',
    },
    haveAccount: 'Already have an account?',
    signIn: 'Sign In',
  },
}
