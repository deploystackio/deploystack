export default {
  title: 'Account Settings',
  
  navigation: {
    profile: 'Profile',
    security: 'Security'
  },
  
  messages: {
    loading: 'Loading account settings...',
    profileUpdated: 'Profile updated successfully',
    passwordChanged: 'Password changed successfully',
    sectionNotFound: 'Section not found.'
  },
  
  profile: {
    title: 'Profile Information',
    description: 'Update your personal information and email address.',
    form: {
      firstName: {
        label: 'First Name'
      },
      lastName: {
        label: 'Last Name'
      },
      username: {
        label: 'Username',
        disabledHelp: 'Username cannot be changed for {authType} authentication.'
      },
      email: {
        label: 'Email'
      },
      saveButton: 'Save Changes',
      savingButton: 'Saving...'
    }
  },
  
  security: {
    title: 'Change Password',
    description: 'Update your password to keep your account secure.',
    unavailable: {
      title: 'Password Management',
      description: 'Password management for your account type.',
      message: 'Password changes are not available for {authType} authentication.',
      help: 'Your account is secured through {provider}. To change your password, please visit your {settingsLocation}.'
    },
    form: {
      currentPassword: {
        label: 'Current Password'
      },
      newPassword: {
        label: 'New Password',
        help: 'Password must be at least 8 characters long.'
      },
      confirmPassword: {
        label: 'Confirm New Password'
      },
      changeButton: 'Change Password',
      changingButton: 'Changing Password...'
    }
  },
  
  errors: {
    unknown: 'An unknown error occurred',
    profileUpdateFailed: 'Failed to update profile',
    passwordChangeFailed: 'Failed to change password',
    passwordsDoNotMatch: 'New passwords do not match'
  },
  
  authTypes: {
    github: 'GitHub',
    email_signup: 'email',
    external: 'external'
  },
  
  providers: {
    github: 'GitHub',
    external: 'your external provider'
  },
  
  settingsLocations: {
    github: 'GitHub account settings',
    external: 'authentication provider'
  },
  
  alerts: {
    success: 'Success',
    error: 'Error',
    dismissLabel: 'Dismiss {type} alert'
  }
}
