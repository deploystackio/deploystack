<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, Plus } from 'lucide-vue-next'

interface Props {
  modelValue: string[]
  placeholder?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const { t } = useI18n()

// New tag input
const newTag = ref('')

// Add tag
const addTag = () => {
  if (newTag.value.trim() && !props.modelValue.includes(newTag.value.trim())) {
    const updatedTags = [...props.modelValue, newTag.value.trim()]
    emit('update:modelValue', updatedTags)
    newTag.value = ''
  }
}

// Remove tag
const removeTag = (tagToRemove: string) => {
  const updatedTags = props.modelValue.filter(tag => tag !== tagToRemove)
  emit('update:modelValue', updatedTags)
}

// Handle keyboard input
const handleTagKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault()
    addTag()
  }
}
</script>

<template>
  <div>
    <!-- Existing Tags -->
    <div v-if="modelValue.length > 0" class="flex flex-wrap gap-2 mb-3">
      <Badge
        v-for="tag in modelValue"
        :key="tag"
        variant="secondary"
        class="flex items-center gap-1"
      >
        {{ tag }}
        <Button
          variant="ghost"
          size="sm"
          class="h-4 w-4 p-0 hover:bg-transparent"
          @click="removeTag(tag)"
        >
          <X class="h-3 w-3" />
        </Button>
      </Badge>
    </div>

    <!-- Add New Tag -->
    <div class="flex gap-2">
      <Input
        v-model="newTag"
        :placeholder="placeholder || t('mcpCatalog.form.basic.tags.placeholder')"
        @keydown="handleTagKeydown"
        class="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        @click="addTag"
        :disabled="!newTag.trim()"
      >
        <Plus class="h-4 w-4" />
      </Button>
    </div>
  </div>
</template>
