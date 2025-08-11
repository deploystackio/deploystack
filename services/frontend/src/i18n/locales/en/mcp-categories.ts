export default {
  mcpCategories: {
    title: 'MCP Categories',
    description: 'Manage categories for organizing MCP servers in the catalog.',
    addButton: 'Add Category',

    messages: {
      createSuccess: 'Category created successfully.',
      updateSuccess: 'Category updated successfully.',
      deleteSuccess: 'Category deleted successfully.',
      fetchError: 'Failed to load categories.',
      createError: 'Failed to create category.',
      updateError: 'Failed to update category.',
      deleteError: 'Failed to delete category.',
    },

    table: {
      loading: 'Loading categories...',
      error: 'Error loading categories: {error}',
      noResults: 'No categories found.',
      noData: 'No categories available.',
      noDescription: 'No description',
      openMenu: 'Open menu',

      search: {
        placeholder: 'Search categories...',
      },

      columns: {
        name: 'Name',
        description: 'Description',
        icon: 'Icon',
        sortOrder: 'Sort Order',
        createdAt: 'Created',
        actions: 'Actions',
      },

      actions: {
        edit: 'Edit',
        delete: 'Delete',
      },
    },

    modal: {
      createTitle: 'Add New Category',
      editTitle: 'Edit Category',
      createDescription: 'Create a new category to organize MCP servers.',
      editDescription: 'Update the category information.',

      form: {
        name: {
          label: 'Category Name',
          placeholder: 'Enter category name',
          description: 'A descriptive name for the category.',
        },
        description: {
          label: 'Description',
          placeholder: 'Enter category description (optional)',
          description: 'Optional description explaining what this category contains.',
        },
        icon: {
          label: 'Icon',
          placeholder: 'Select an icon',
          description: 'Choose a Lucide icon to represent this category.',
          none: 'No icon',
        },
        sortOrder: {
          label: 'Sort Order',
          placeholder: '0',
          description: 'Lower numbers appear first in lists.',
        },
      },

      cancel: 'Cancel',
      create: 'Create Category',
      update: 'Update Category',
      saving: 'Saving...',

      errors: {
        unknown: 'An unknown error occurred.',
      },
    },

    deleteDialog: {
      title: 'Delete Category',
      description: 'Are you sure you want to delete the category "{categoryName}"? This action cannot be undone.',
      cancel: 'Cancel',
      confirm: 'Delete',
    },
  },
}
