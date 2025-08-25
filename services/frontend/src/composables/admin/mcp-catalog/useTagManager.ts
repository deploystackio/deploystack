import { ref } from 'vue'

/**
 * Composable for managing tag input and operations
 * Provides tag addition, removal, and keyboard handling
 */
export function useTagManager(
  currentTags: () => string[],
  updateTags: (tags: string[]) => void
) {
  const newTag = ref('')

  const addTag = () => {
    const trimmedTag = newTag.value.trim()
    if (trimmedTag && !currentTags().includes(trimmedTag)) {
      updateTags([...currentTags(), trimmedTag])
      newTag.value = ''
    }
  }

  const removeTag = (tagToRemove: string) => {
    updateTags(currentTags().filter(tag => tag !== tagToRemove))
  }

  const handleTagKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addTag()
    }
  }

  return {
    newTag,
    addTag,
    removeTag,
    handleTagKeydown
  }
}
