export default {
  title: 'Email Verification',
  loading: {
    message: 'Verifying your email address...'
  },
  success: {
    title: 'Email Verified Successfully!',
    button: 'Continue to Login'
  },
  error: {
    title: 'Verification Failed',
    alertTitle: 'Verification Error',
    resendSection: {
      title: 'Resend Verification Email',
      placeholder: 'Enter your email address',
      button: 'Resend Verification Email',
      buttonSending: 'Sending...'
    },
    navigation: {
      backToLogin: 'Back to Login',
      registerAgain: 'Register Again'
    }
  },
  alerts: {
    emailSent: 'Email Sent'
  },
  errors: {
    noToken: 'No verification token provided. Please check your email link.',
    enterEmail: 'Please enter your email address to resend verification.',
    networkError: 'Unable to connect to server. Please try again later.',
    invalidToken: 'Invalid or expired verification token.',
    serverError: 'Server error occurred. Please try again later.',
    timeout: 'Request timed out. Please try again.',
    unknownError: 'An unexpected error occurred during verification.',
    resendFailed: 'An unexpected error occurred while sending verification email.'
  }
}
