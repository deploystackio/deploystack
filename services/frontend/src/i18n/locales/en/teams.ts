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
    }
  }
}
