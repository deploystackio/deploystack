export default {
  teams: {
    title: 'My Teams',
    description: 'Manage your teams and view your role in each team.',
    addButton: 'Add Team',
    table: {
      loading: 'Loading teams...',
      error: 'Error loading teams: {error}',
      noResults: 'No teams found.',
      search: {
        placeholder: 'Search teams...'
      }
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
      errors: {
        limitReached: 'You have reached the maximum limit of 3 teams.',
        noPermission: 'You do not have permission to create teams.',
        unknown: 'An error occurred while creating the team.'
      }
    },
    manage: {
      title: 'Manage Team',
      description: 'Edit team settings and manage team details.',
      backToTeams: 'Back to Teams',
      loading: 'Loading team details...',
      defaultTeam: 'Default Team',
      teamId: 'Team ID',
      created: 'Created',
      updated: 'Updated',
      editTeam: 'Edit Team',
      editDescription: 'Update team name and description. Note: Default team names cannot be changed.',
      saveSuccess: 'Team updated successfully!',
      save: 'Save Changes',
      saving: 'Saving...',
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
