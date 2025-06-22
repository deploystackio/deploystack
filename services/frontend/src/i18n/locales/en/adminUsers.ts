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
        openMenu: 'Open menu'
      },
      status: {
        email: 'Email',
        github: 'GitHub'
      },
      noResults: 'No users found.',
      loading: 'Loading users...',
      error: 'Error loading users: {error}'
    },
    pagination: {
      previous: 'Previous',
      next: 'Next',
      rowsSelected: '{selected} of {total} row(s) selected.'
    }
  },
}
