<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Team, UpdateTeamAdminRequest } from '@/views/admin/teams/types'

const { t } = useI18n()

interface Props {
  team: Team
  isSubmitting?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [data: UpdateTeamAdminRequest]
  cancel: []
}>()

const formData = ref<UpdateTeamAdminRequest>({
  name: '',
  description: '',
  non_http_mcp_limit: 0,
  mcp_server_limit: 0
})

const errors = ref<Record<string, string>>({})

onMounted(() => {
  // Initialize form with team data
  formData.value = {
    name: props.team.name,
    description: props.team.description,
    non_http_mcp_limit: props.team.non_http_mcp_limit,
    mcp_server_limit: props.team.mcp_server_limit
  }
})

const validateForm = (): boolean => {
  errors.value = {}

  // Validate name
  if (!formData.value.name || formData.value.name.trim().length === 0) {
    errors.value.name = t('adminTeams.teamEdit.form.nameRequired')
    return false
  }
  if (formData.value.name.length > 100) {
    errors.value.name = t('adminTeams.teamEdit.form.nameMaxLength')
    return false
  }

  // Validate description
  if (formData.value.description && formData.value.description.length > 500) {
    errors.value.description = t('adminTeams.teamEdit.form.descriptionMaxLength')
    return false
  }

  // Validate non_http_mcp_limit
  if (formData.value.non_http_mcp_limit !== undefined && formData.value.non_http_mcp_limit < 0) {
    errors.value.non_http_mcp_limit = t('adminTeams.teamEdit.form.mcpLimitMin')
    return false
  }

  // Validate mcp_server_limit
  if (formData.value.mcp_server_limit !== undefined && formData.value.mcp_server_limit < 0) {
    errors.value.mcp_server_limit = t('adminTeams.teamEdit.form.mcpLimitMin')
    return false
  }

  return true
}

const handleSubmit = () => {
  if (!validateForm()) {
    return
  }

  // Only send fields that have changed
  const updates: UpdateTeamAdminRequest = {}

  if (formData.value.name !== props.team.name) {
    updates.name = formData.value.name
  }

  if (formData.value.description !== props.team.description) {
    updates.description = formData.value.description || null
  }

  if (formData.value.non_http_mcp_limit !== props.team.non_http_mcp_limit) {
    updates.non_http_mcp_limit = formData.value.non_http_mcp_limit
  }

  if (formData.value.mcp_server_limit !== props.team.mcp_server_limit) {
    updates.mcp_server_limit = formData.value.mcp_server_limit
  }

  emit('submit', updates)
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <!-- Team Name -->
    <div class="space-y-2">
      <Label for="name" class="required">
        {{ t('adminTeams.teamEdit.form.name') }}
      </Label>
      <Input
        id="name"
        v-model="formData.name"
        :placeholder="t('adminTeams.teamEdit.form.namePlaceholder')"
        :disabled="isSubmitting"
        :class="{ 'border-red-500': errors.name }"
        required
      />
      <p v-if="errors.name" class="text-sm text-red-500">
        {{ errors.name }}
      </p>
    </div>

    <!-- Description -->
    <div class="space-y-2">
      <Label for="description">
        {{ t('adminTeams.teamEdit.form.description') }}
      </Label>
      <Textarea
        id="description"
        :model-value="formData.description ?? ''"
        @update:model-value="(value) => formData.description = (typeof value === 'string' ? value : String(value)) || null"
        :placeholder="t('adminTeams.teamEdit.form.descriptionPlaceholder')"
        :disabled="isSubmitting"
        :class="{ 'border-red-500': errors.description }"
        rows="4"
      />
      <p v-if="errors.description" class="text-sm text-red-500">
        {{ errors.description }}
      </p>
    </div>

    <!-- Total MCP Server Limit -->
    <div class="space-y-2">
      <Label for="mcp_server_limit" class="required">
        {{ t('adminTeams.teamEdit.form.totalMcpLimit') }}
      </Label>
      <Input
        id="mcp_server_limit"
        v-model.number="formData.mcp_server_limit"
        type="number"
        min="0"
        :disabled="isSubmitting"
        :class="{ 'border-red-500': errors.mcp_server_limit }"
        required
      />
      <p class="text-sm text-muted-foreground">
        {{ t('adminTeams.teamEdit.form.totalMcpLimitHelp') }}
      </p>
      <p v-if="errors.mcp_server_limit" class="text-sm text-red-500">
        {{ errors.mcp_server_limit }}
      </p>
    </div>

    <!-- Non-HTTP MCP Limit -->
    <div class="space-y-2">
      <Label for="non_http_mcp_limit" class="required">
        {{ t('adminTeams.teamEdit.form.mcpLimit') }}
      </Label>
      <Input
        id="non_http_mcp_limit"
        v-model.number="formData.non_http_mcp_limit"
        type="number"
        min="0"
        :disabled="isSubmitting"
        :class="{ 'border-red-500': errors.non_http_mcp_limit }"
        required
      />
      <p class="text-sm text-muted-foreground">
        {{ t('adminTeams.teamEdit.form.mcpLimitHelp') }}
      </p>
      <p v-if="errors.non_http_mcp_limit" class="text-sm text-red-500">
        {{ errors.non_http_mcp_limit }}
      </p>
    </div>

    <!-- Form Actions -->
    <div class="flex justify-end gap-4">
      <Button
        type="button"
        variant="outline"
        @click="handleCancel"
        :disabled="isSubmitting"
      >
        {{ t('adminTeams.teamEdit.form.cancel') }}
      </Button>
      <Button
        type="submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? t('adminTeams.teamEdit.form.submitting') : t('adminTeams.teamEdit.form.submit') }}
      </Button>
    </div>
  </form>
</template>

<style scoped>
.required::after {
  content: ' *';
  color: red;
}
</style>
