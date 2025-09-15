export default {
  title: 'Satellite Management',
  description: 'Manage and monitor all satellites in the system',

  // Status labels
  status: {
    active: 'Active',
    inactive: 'Inactive',
    maintenance: 'Maintenance',
    error: 'Error'
  },

  // Type labels
  type: {
    global: 'Global',
    team: 'Team'
  },

  // Table structure
  table: {
    loading: 'Loading satellites...',
    error: 'Error loading satellites: {error}',
    noData: 'No satellites found',

    columns: {
      name: 'Name',
      type: 'Type',
      status: 'Status',
      lastHeartbeat: 'Last Heartbeat',
      capabilities: 'Capabilities',
      actions: 'Actions'
    },

    search: {
      placeholder: 'Search satellites by name...'
    },

    actions: {
      updateStatus: 'Update Status'
    }
  },

  // Filters
  filters: {
    status: {
      placeholder: 'Filter by status',
      all: 'All Statuses'
    },
    type: {
      placeholder: 'Filter by type',
      all: 'All Types'
    }
  },

  // Actions
  actions: {
    refresh: 'Refresh',
    search: 'Search',
    setStatus: 'Set to {status}'
  },

  // Messages
  messages: {
    fetchError: 'Failed to load satellites',
    statusUpdateSuccess: 'Satellite status updated successfully',
    statusUpdateError: 'Failed to update satellite status'
  },

  // Errors
  errors: {
    insufficientPermissions: 'You do not have permission to view satellites',
    permissionCheckFailed: 'Failed to check user permissions'
  },

  // Status update dialog
  statusUpdateDialog: {
    title: 'Update Satellite Status',
    description: 'Are you sure you want to change the status of "{satelliteName}" from {currentStatus} to {newStatus}?',
    cancel: 'Cancel',
    confirm: 'Update Status'
  },

  // Pagination
  pagination: {
    showing: 'Showing {start} to {end} of {total} satellites',
    page: 'Page {current} of {total}',
    previous: 'Previous',
    next: 'Next'
  }
}
