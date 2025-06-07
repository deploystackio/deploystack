// @/i18n/locales/en/resetPassword.ts
export default {
  resetPassword: {
    title: 'Set New Password',
    subtitle: 'Enter your new password below.',
    form: {
      password: {
        label: 'New Password',
        placeholder: 'Enter your new password'
      },
      confirmPassword: {
        label: 'Confirm Password',
        placeholder: 'Confirm your new password'
      }
    },
    buttons: {
      submit: 'Reset Password',
      loading: 'Resetting...',
      backToLogin: 'Back to Login'
    },
    success: {
      title: 'Password Reset Successful',
      message: 'Your password has been successfully reset.',
      instruction: 'You can now log in with your new password.'
    },
    errors: {
      title: 'Error',
      invalidToken: 'This password reset link is invalid or has expired.',
      expiredToken: 'This password reset link has expired. Please request a new one.',
      weakPassword: 'Password must be at least 8 characters long.',
      passwordMismatch: 'Passwords do not match.',
      networkError: 'Network error. Please check your connection and try again.',
      serverError: 'Server error. Please try again later.',
      serviceUnavailable: 'Password reset service is currently unavailable.',
      unknownError: 'An unexpected error occurred. Please try again.'
    }
  }
}
