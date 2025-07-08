<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RepositoryFormData } from '@/views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: RepositoryFormData
  formData: any
}

interface Emits {
  (e: 'update:modelValue', value: RepositoryFormData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Computed model
const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.repository.title') }}</h3>
      <p class="text-sm text-muted-foreground">{{ t('mcpCatalog.form.repository.subtitle') }}</p>
    </div>

    <!-- GitHub Repository URL -->
    <div class="space-y-2">
      <Label for="github_url">{{ t('mcpCatalog.form.repository.githubUrl.label') }}</Label>
      <Input
        id="github_url"
        v-model="localValue.github_url"
        :placeholder="t('mcpCatalog.form.repository.githubUrl.placeholder')"
        type="url"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('mcpCatalog.form.repository.githubUrl.description') }}
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Git Branch -->
      <div class="space-y-2">
        <Label for="git_branch">{{ t('mcpCatalog.form.repository.branch.label') }}</Label>
        <Input
          id="git_branch"
          v-model="localValue.git_branch"
          :placeholder="t('mcpCatalog.form.repository.branch.placeholder')"
        />
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.repository.branch.description') }}
        </p>
      </div>

      <!-- Homepage URL -->
      <div class="space-y-2">
        <Label for="homepage_url">{{ t('mcpCatalog.form.repository.homepage.label') }}</Label>
        <Input
          id="homepage_url"
          v-model="localValue.homepage_url"
          :placeholder="t('mcpCatalog.form.repository.homepage.placeholder')"
          type="url"
        />
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.repository.homepage.description') }}
        </p>
      </div>
    </div>
  </div>
</template>
