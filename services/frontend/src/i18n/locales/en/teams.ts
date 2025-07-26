export default {
  teams: {
    title: 'My Teams',
    description: 'Manage your teams and view your role in each team.',
    addButton: 'Add Team',
    table: {
      loading: 'Loading teams...',
      error: 'Error loading teams: {error}',
      noResults: 'No teams found.',
      noDescription: 'No description',
      selected: 'Selected',
      switch: 'Switch',
      manage: 'Manage',
      noActions: 'No actions',
      search: {
        placeholder: 'Search teams...'
      },
      columns: {
        name: 'Team Name',
        description: 'Description',
        role: 'Your Role',
        created: 'Created',
        switch: 'Switch Team',
        actions: 'Actions'
      }
    },
    messages: {
      deleteSuccess: 'Team "{teamName}" has been successfully deleted.',
      deleteSuccessDescription: 'All team resources and configurations have been permanently removed.'
    },
    pagination: {
      rowsSelected: '{selected} of {total} row(s) selected.',
      previous: 'Previous',
      next: 'Next'
    },
    addModal: {
      title: 'Create New Team',
      description: 'Create a new team to organize your work. You can create up to 3 teams.',
      fields: {
        name: {
          label: 'Team Name',
          placeholder: 'Enter team name'
        },
        description: {
          label: 'Description',
          placeholder: 'Enter team description (optional)'
        }
      },
      buttons: {
        cancel: 'Cancel',
        create: 'Create Team',
        creating: 'Creating...'
      },
      messages: {
        createSuccess: 'Team "{teamName}" has been created successfully!',
        createSuccessGeneric: 'Team has been created successfully!',
        createSuccessDescription: 'Your new team is ready to use and you can start deploying MCP servers.'
      },
      errors: {
        limitReached: 'You have reached the maximum limit of 3 teams.',
        noPermission: 'You do not have permission to create teams.',
        unknown: 'An error occurred while creating the team.',
        createFailed: 'Failed to create team',
        refreshFailed: 'Team was created but failed to refresh the teams list. Please refresh the page.'
      }
    },
    manage: {
      title: 'Manage Team',
      description: 'Edit team settings and manage team details.',
      backToTeams: 'Back to Teams',
      loading: 'Loading team details...',
      defaultTeam: 'Default Team',
      teamId: 'Team ID',
      teamDetails: 'Team Details',
      teamDetailsDescription: 'View and manage team information and settings.',
      teamInfo: 'Team Information',
      status: 'Status',
      created: 'Created',
      updated: 'Updated',
      editTeam: 'Edit Team',
      editDescription: 'Update team name and description. Note: Default team names cannot be changed.',
      saveSuccess: 'Team updated successfully!',
      saveSuccessDescription: 'Your team settings have been saved.',
      saveError: 'Failed to save team',
      save: 'Save Changes',
      saving: 'Saving...',
      members: {
        title: 'Team Members',
        memberCount: '{current} of {max} members',
        addMember: 'Add Member',
        loadingUser: 'Loading user information...',
        loadingMembers: 'Loading team members...',
        unknownUser: 'Unknown User',
        defaultTeamNotice: 'This is your default team. Default teams are personal workspaces and cannot have additional members.',
        noMembers: {
          title: 'No additional members',
          description: 'Invite team members to collaborate on your MCP server deployments.',
          addFirstMember: 'Add First Member'
        },
        info: {
          title: 'Team Collaboration',
          maxMembers: 'Teams can have up to 3 members maximum',
          adminAccess: 'Team administrators can manage all team resources',
          userAccess: 'Team users have read-only access to team resources',
          defaultTeamNote: 'Default teams remain personal workspaces'
        },
        roles: {
          owner: 'Owner',
          admin: 'Administrator',
          user: 'User'
        },
        messages: {
          apiUrlNotConfigured: 'API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.',
          fetchMembersFailed: 'Failed to fetch team members: {status}',
          memberNotFound: 'Could not find team member for display member'
        },
        errors: {
          unableToLoadUser: 'Unable to load user information',
          failedToLoadUser: 'Failed to load user information',
          unauthorized: 'Unauthorized - please log in',
          invalidResponse: 'Invalid response format',
          failedToLoadMembers: 'Failed to load team members'
        },
        addModal: {
          title: 'Add Team Member',
          description: 'Add a new member to your team by entering their email address.',
          fields: {
            email: {
              label: 'Email Address',
              placeholder: 'Enter member email address'
            },
            role: {
              label: 'Role',
              placeholder: 'Select role',
              options: {
                admin: 'Team Administrator',
                user: 'Team User'
              }
            }
          },
          buttons: {
            cancel: 'Cancel',
            add: 'Add Member',
            adding: 'Adding...'
          },
          messages: {
            success: 'Member added successfully!',
            successDescription: '{email} has been added to the team as {role}.',
            error: 'Failed to add member',
            emailRequired: 'Email address is required',
            invalidEmail: 'Please enter a valid email address',
            roleRequired: 'Please select a role for the member',
            apiUrlNotConfigured: 'API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.',
            addMemberFailed: 'Failed to add member: {status}',
            unknownError: 'Unknown error occurred'
          }
        },
        removeModal: {
          title: 'Remove Team Member',
          description: 'Are you sure you want to remove this member from the team?',
          warning: 'This member will lose access to all team resources and will need to be re-invited to rejoin the team.',
          buttons: {
            cancel: 'Cancel',
            remove: 'Remove Member',
            removing: 'Removing...'
          },
          messages: {
            success: 'Member removed successfully!',
            successDescription: '{email} has been removed from the team.',
            error: 'Failed to remove member',
            apiUrlNotConfigured: 'API URL not configured. Make sure VITE_DEPLOYSTACK_BACKEND_URL is set.',
            unknownUser: 'Unknown User',
            noMemberToRemove: 'No member to remove',
            removeMemberFailed: 'Failed to remove member: {status}',
            unknownError: 'Unknown error occurred'
          }
        }
      },
      fields: {
        name: {
          label: 'Team Name',
          placeholder: 'Enter team name',
          defaultTeamNote: 'Default team names cannot be changed.',
          noPermission: 'You do not have permission to edit the team name.'
        },
        description: {
          label: 'Description',
          placeholder: 'Enter team description (optional)',
          noDescription: 'No description provided.',
          noPermission: 'You do not have permission to edit the team description.'
        }
      },
      dangerZone: {
        title: 'Danger Zone',
        description: 'Permanently delete this team. This action cannot be undone.',
        deleteButton: 'Delete Team'
      },
      deleteDialog: {
        title: 'Delete Team',
        warning: 'Are you absolutely sure you want to delete this team?',
        teamName: 'Team Name',
        consequences: 'This action will permanently delete:',
        consequencesList: {
          servers: 'All MCP server configurations and deployments',
          credentials: 'All cloud provider credentials and API keys',
          variables: 'All global environment variables',
          history: 'Complete deployment history and logs'
        },
        cancel: 'Cancel',
        confirm: 'Delete Team',
        deleting: 'Deleting...'
      }
    }
  }
}
