// @/i18n/locales/en/forgotPassword.ts
export default {
  forgotPassword: {
    title: 'Reset Password',
    subtitle: 'Enter your email address and we\'ll send you a link to reset your password.',
    form: {
      email: {
        label: 'Email Address',
        placeholder: 'Enter your email address'
      }
    },
    buttons: {
      submit: 'Send Reset Link',
      loading: 'Sending...',
      backToLogin: 'Back to Login'
    },
    success: {
      title: 'Check Your Email',
      message: 'If an account with that email exists, we\'ve sent you a password reset link.',
      instruction: 'Please check your email and follow the instructions to reset your password.'
    },
    errors: {
      title: 'Error',
      networkError: 'Network error. Please check your connection and try again.',
      serverError: 'Server error. Please try again later.',
      invalidEmail: 'Please enter a valid email address.',
      serviceUnavailable: 'Password reset service is currently unavailable.',
      unknownError: 'An unexpected error occurred. Please try again.'
    }
  }
}
