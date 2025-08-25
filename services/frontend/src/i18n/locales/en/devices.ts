export default {
  title: 'Device Management',
  description: 'Manage your registered devices and their configurations',
  
  // Page headers
  pageTitle: 'My Devices',
  pageDescription: 'Manage devices that can access your MCP configurations',
  
  // Stats
  stats: {
    total: 'Total Devices',
    active: 'Active',
    trusted: 'Trusted',
    inactive: 'Inactive'
  },
  
  // Table columns
  table: {
    noData: 'No devices found',
    noDescription: 'No description provided',
    openMenu: 'Open device menu',
    columns: {
      deviceName: 'Device Name',
      operatingSystem: 'Operating System',
      lastActivity: 'Last Activity',
      status: 'Status',
      trustStatus: 'Trust Status',
      actions: 'Actions'
    }
  },
  
  // Status values
  status: {
    active: 'Active',
    inactive: 'Inactive',
    trusted: 'Trusted',
    untrusted: 'Untrusted',
    current: 'Current Device'
  },
  
  // Operating Systems
  os: {
    unknown: 'Unknown OS',
    windows: 'Windows',
    macos: 'macOS',
    linux: 'Linux',
    darwin: 'macOS'
  },
  
  // Time display
  time: {
    never: 'Never',
    justNow: 'Just now',
    minutesAgo: '{minutes} minutes ago',
    hoursAgo: '{hours} hours ago',
    daysAgo: '{days} days ago',
    weeksAgo: '{weeks} weeks ago',
    monthsAgo: '{months} months ago'
  },
  
  // Actions
  actions: {
    viewDetails: 'View Details',
    editDevice: 'Edit Device',
    removeDevice: 'Remove Device',
    trustDevice: 'Trust Device',
    untrustDevice: 'Untrust Device'
  },
  
  // Dialogs
  editDialog: {
    title: 'Edit Device Friendly Name',
    description: 'Update your device friendly name',
    fields: {
      deviceName: {
        label: 'Device Name',
        placeholder: 'Enter a friendly name for this device'
      }
    },
    buttons: {
      cancel: 'Cancel',
      save: 'Save Changes',
      saving: 'Saving...'
    }
  },
  
  removeDialog: {
    title: 'Remove Device',
    description: 'Are you sure you want to remove "{deviceName}"? This will revoke access to all MCP configurations on this device.',
    warning: 'This action cannot be undone. The device will need to login again to regain access.',
    success: 'Device removed successfully',
    successDescription: '{deviceName} has been removed from your account',
    buttons: {
      cancel: 'Cancel',
      remove: 'Remove Device',
      removing: 'Removing...'
    }
  },
  
  // Messages
  messages: {
    deviceUpdated: 'Device updated successfully',
    deviceRemoved: 'Device removed successfully',
    deviceTrusted: 'Device marked as trusted',
    deviceUntrusted: 'Device marked as untrusted',
    currentDeviceWarning: 'This is your current device',
    cannotRemoveCurrentDevice: 'You cannot remove the device you are currently using'
  },
  
  // Errors
  errors: {
    loadDevices: 'Failed to load devices',
    updateDevice: 'Failed to update device',
    removeDevice: 'Failed to remove device',
    trustDevice: 'Failed to update device trust status'
  },
  
  // Empty state
  emptyState: {
    title: 'No devices registered',
    description: 'You have no registered devices. Devices are automatically registered when you login with the',
    deployStackCli: 'DeployStack CLI',
    descriptionEnd: '.',
    action: 'Learn about device management'
  },

  // Device detail view
  detail: {
    title: 'Device Details',
    backToDevices: 'Back to Devices',
    loadingMessage: 'Loading device details...',
    loadError: 'Failed to load device',
    systemInformation: {
      title: 'System Information',
      description: 'Hardware and system details for this device'
    },
    activityInformation: {
      title: 'Activity Information',
      description: 'Registration and usage timestamps for this device'
    },
    fields: {
      deviceId: 'Device ID',
      hostname: 'Hostname',
      operatingSystem: 'Operating System',
      architecture: 'Architecture',
      nodeVersion: 'Node.js Version',
      hardwareId: 'Hardware ID',
      userAgent: 'User Agent',
      deviceRegistered: 'Device Registered',
      lastUpdated: 'Last Updated',
      lastLogin: 'Last Login',
      lastActivity: 'Last Activity',
      unknown: 'Unknown'
    }
  }
}
