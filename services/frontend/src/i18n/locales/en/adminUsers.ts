export default {
  adminUsers: {
    title: 'User Management',
    description: 'Manage all users in the system.',
    table: {
      columns: {
        registration: 'Registration',
        name: 'Name',
        email: 'Email',
        role: 'Role',
        actions: 'Actions'
      },
      search: {
        placeholder: 'Search users...'
      },
      actions: {
        resetPassword: 'Reset Password',
        openMenu: 'Open menu',
        view: 'View User'
      },
      status: {
        email: 'Email',
        github: 'GitHub'
      },
      noResults: 'No users found.',
      noRole: 'No role assigned',
      loading: 'Loading users...',
      error: 'Error loading users: {error}'
    },
    pagination: {
      previous: 'Previous',
      next: 'Next',
      rowsSelected: '{selected} of {total} row(s) selected.'
    },
    userDetail: {
      title: 'User: {username}',
      titleLoading: 'User: Loading...',
      backToUsers: 'Back to Users',
      loading: 'Loading user details...',
      errorLoading: 'Error loading user: {error}',
      userInformation: 'User Information',
      personalDetails: 'Personal details and account information.',
      fields: {
        fullName: 'Full name',
        username: 'Username',
        emailAddress: 'Email address',
        role: 'Role',
        registrationMethod: 'Registration method',
        githubId: 'GitHub ID',
        accountDetails: 'Account details',
        permissions: 'Permissions'
      },
      values: {
        notProvided: 'Not provided',
        noRoleAssigned: 'No role assigned',
        email: 'Email',
        github: 'GitHub',
        firstName: 'First name:',
        lastName: 'Last name:',
        userId: 'User ID:',
        active: 'Active'
      },
      actions: {
        title: 'User Actions',
        forceResetPassword: 'Force Reset Password',
        resetPasswordConfirm: {
          title: 'Force Reset Password',
          description: 'Are you sure you want to force reset password for {username}? They will receive an email with reset instructions.',
          cancel: 'Cancel',
          confirm: 'Send Reset Email'
        },
        resetPasswordSuccess: 'Password reset email sent successfully to {email}',
        resetPasswordError: 'Failed to send password reset email: {error}',
        resetPasswordDisabled: 'Password reset is only available for users who registered with email'
      }
    }
  },
}
