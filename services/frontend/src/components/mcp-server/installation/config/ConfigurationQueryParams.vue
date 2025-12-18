<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { Eye, EyeOff } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { DsCard } from '@/components/ui/ds-card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { McpInstallation, UserConfiguration } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  serverData: any
  currentUserConfig: UserConfiguration | null
  teamId: string
  canEdit?: boolean
  isTeamAdmin: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: true
})

const emit = defineEmits<{
  'installation-updated': [installation: McpInstallation]
  'configuration-updated': [config: UserConfiguration]
}>()

const isEditModalOpen = ref(false)
const editingItem = ref<any>(null)
const editingValue = ref('')
const editingScope = ref<'team' | 'user'>('user')
const showPassword = ref(false)
const isSubmitting = ref(false)
const formErrors = ref<Record<string, string>>({})

const teamQueryParamsSchema = computed(() => {
  const schema = props.installation.server?.team_url_query_params_schema || props.serverData?.team_url_query_params_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

const userQueryParamsSchema = computed(() => {
  const schema = props.installation.server?.user_url_query_params_schema || props.serverData?.user_url_query_params_schema
  if (!schema) return []
  try {
    return Array.isArray(schema) ? schema : JSON.parse(schema)
  } catch {
    return []
  }
})

const currentTeamQueryParams = computed(() => {
  return props.installation.team_url_query_params || {}
})

const currentUserQueryParams = computed(() => {
  return (props.currentUserConfig?.user_url_query_params as Record<string, any>) || {}
})

const teamQueryParamsWithData = computed(() => {
  return teamQueryParamsSchema.value.map((paramSchema: any) => ({
    ...paramSchema,
    currentValue: currentTeamQueryParams.value[paramSchema.name] || ''
  }))
})

const userQueryParamsWithData = computed(() => {
  return userQueryParamsSchema.value.map((paramSchema: any) => ({
    ...paramSchema,
    currentValue: currentUserQueryParams.value[paramSchema.name] || ''
  }))
})

const openEditModal = (item: any, scope: 'team' | 'user') => {
  editingItem.value = item
  editingScope.value = scope
  editingValue.value = scope === 'team' ? (currentTeamQueryParams.value[item.name] || '') : (currentUserQueryParams.value[item.name] || '')
  showPassword.value = false
  formErrors.value = {}
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  editingItem.value = null
  editingValue.value = ''
  editingScope.value = 'user'
  showPassword.value = false
  formErrors.value = {}
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

const getInputType = (item: any) => {
  if ((item.type === 'password' || item.type === 'secret') && !showPassword.value) {
    return 'password'
  }
  return 'text'
}

const isTextarea = (item: any) => {
  return item.type === 'textarea' ||
         (item.description && item.description.toLowerCase().includes('json')) ||
         (item.placeholder && item.placeholder.length > 100)
}

const validateForm = () => {
  const errors: Record<string, string> = {}

  if (editingItem.value?.required && !editingValue.value.trim()) {
    errors.value = 'This field is required'
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) return

  isSubmitting.value = true

  try {
    if (editingScope.value === 'team') {
      const updatedQueryParams = {
        ...currentTeamQueryParams.value,
        [editingItem.value.name]: editingValue.value
      }

      const updatedInstallation = await McpInstallationService.updateTeamQueryParams(
        props.teamId,
        props.installation.id,
        updatedQueryParams
      )

      emit('installation-updated', updatedInstallation)

      toast.success('Team query parameter updated', {
        description: `${editingItem.value.name} has been updated successfully`
      })
    } else {
      if (!props.currentUserConfig) {
        const createData = {
          user_url_query_params: {
            [editingItem.value.name]: editingValue.value
          }
        }

        const newConfig = await McpInstallationService.createUserConfiguration(
          props.teamId,
          props.installation.id,
          createData
        )

        emit('configuration-updated', newConfig)
      } else {
        const updatedQueryParams = { ...(props.currentUserConfig.user_url_query_params as Record<string, any> || {}) }
        updatedQueryParams[editingItem.value.name] = editingValue.value

        const updatedConfig = await McpInstallationService.updateUserQueryParams(
          props.teamId,
          props.installation.id,
          props.currentUserConfig.id,
          updatedQueryParams
        )

        emit('configuration-updated', updatedConfig)
      }

      toast.success('User query parameter updated', {
        description: `${editingItem.value.name} has been updated successfully`
      })
    }

    closeEditModal()
  } catch (error) {
    console.error('Error updating query parameter:', error)
    toast.error('Failed to update query parameter', {
      description: error instanceof Error ? error.message : 'An error occurred'
    })
    formErrors.value.general = error instanceof Error ? error.message : 'Failed to update configuration'
  } finally {
    isSubmitting.value = false
  }
}

const modalTitle = computed(() => {
  if (!editingItem.value) return ''
  const scope = editingScope.value === 'team' ? 'Team' : 'User'
  return `Edit ${scope} Query Parameter: ${editingItem.value.name}`
})
</script>

<template>
  <!-- Team Query Parameters Card (only visible to team_admin) -->
  <DsCard v-if="isTeamAdmin && teamQueryParamsSchema.length > 0" title="Team Query Parameters">
    <p class="text-sm text-muted-foreground mb-4">
      Configuration managed by team administrators
    </p>

      <ul role="list" class="space-y-3">
        <li v-for="param in teamQueryParamsWithData" :key="param.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-x-3">
              <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                {{ param.name }}
              </p>
            </div>
            <div class="mt-1 text-xs/5 text-gray-700">
              <span class="font-medium text-gray-800">Required:</span>
              <span class="ml-1">{{ param.required ? 'Yes' : 'No' }}</span>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="space-y-1 text-xs/5 text-gray-700">
              <div v-if="param.type">
                <span class="font-medium text-gray-800">Type:</span>
                <span class="ml-1">{{ param.type }}</span>
              </div>
              <div v-if="param.description">
                <span class="font-medium text-gray-800">Description:</span>
                <span class="ml-1">{{ param.description }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-800">Value:</span>
                <span v-if="param.type === 'password' || param.type === 'secret'" class="ml-1 font-mono">
                  {{ param.currentValue ? '••••••••' : 'Not set' }}
                </span>
                <span v-else class="ml-1 font-mono">
                  {{ param.currentValue || 'Not set' }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-none items-center gap-x-4">
            <Button
              v-if="canEdit"
              size="sm"
              variant="outline"
              @click="openEditModal(param, 'team')"
            >
              Edit Value
            </Button>
            <Button
              v-else
              size="sm"
              variant="outline"
              disabled
              class="cursor-not-allowed opacity-50"
            >
              Edit Value
            </Button>
          </div>
        </li>
      </ul>
  </DsCard>

  <!-- User Query Parameters Card (visible to all) -->
  <DsCard v-if="userQueryParamsSchema.length > 0" title="Your Query Parameters">
    <p class="text-sm text-muted-foreground mb-4">
      Your personal configuration overrides
    </p>

      <ul role="list" class="space-y-3">
        <li v-for="param in userQueryParamsWithData" :key="param.name" class="flex items-center justify-between gap-x-6 py-5 bg-white dark:bg-card border rounded-lg px-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-x-3">
              <p class="text-sm/6 font-semibold text-gray-900 font-mono">
                {{ param.name }}
              </p>
            </div>
            <div class="mt-1 text-xs/5 text-gray-700">
              <span class="font-medium text-gray-800">Required:</span>
              <span class="ml-1">{{ param.required ? 'Yes' : 'No' }}</span>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="space-y-1 text-xs/5 text-gray-700">
              <div v-if="param.type">
                <span class="font-medium text-gray-800">Type:</span>
                <span class="ml-1">{{ param.type }}</span>
              </div>
              <div v-if="param.description">
                <span class="font-medium text-gray-800">Description:</span>
                <span class="ml-1">{{ param.description }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-800">Value:</span>
                <span v-if="param.type === 'password' || param.type === 'secret'" class="ml-1 font-mono">
                  {{ param.currentValue ? '••••••••' : 'Not set' }}
                </span>
                <span v-else class="ml-1 font-mono">
                  {{ param.currentValue || 'Not set' }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex flex-none items-center gap-x-4">
            <Button
              size="sm"
              variant="outline"
              @click="openEditModal(param, 'user')"
            >
              Edit Value
            </Button>
          </div>
        </li>
      </ul>
  </DsCard>

  <!-- Edit Modal -->
    <AlertDialog :open="isEditModalOpen" @update:open="(value) => isEditModalOpen = value">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            Configure the value for this query parameter
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="editingItem" class="bg-gray-50 rounded-lg p-4 space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">Query Parameter</span>
              <code class="bg-gray-200 text-gray-800 px-2 py-1 rounded font-mono text-xs font-semibold">
                {{ editingItem.name }}
              </code>
              <Badge v-if="editingItem.required" variant="default" class="text-xs">
                Required
              </Badge>
            </div>
            <div v-if="editingItem.description" class="text-sm text-gray-600">
              {{ editingItem.description }}
            </div>
          </div>

          <div v-if="formErrors.general" class="text-sm text-destructive">
            {{ formErrors.general }}
          </div>

          <div class="space-y-2">
            <Label for="config-value">{{ editingScope === 'team' ? 'Team Value' : 'User Value' }}</Label>

            <div v-if="editingItem && isTextarea(editingItem)" class="relative">
              <Textarea
                id="config-value"
                v-model="editingValue"
                :placeholder="editingItem.placeholder || 'Enter value'"
                class="min-h-[100px]"
                :class="{ 'border-destructive': formErrors.value }"
                :required="editingItem.required"
              />
            </div>

            <div v-else class="relative">
              <Input
                id="config-value"
                :type="editingItem ? getInputType(editingItem) : 'text'"
                v-model="editingValue"
                :placeholder="editingItem?.placeholder || 'Enter value'"
                :class="{ 'border-destructive': formErrors.value }"
                :required="editingItem?.required"
              />

              <Button
                v-if="editingItem?.type === 'password' || editingItem?.type === 'secret'"
                type="button"
                variant="ghost"
                size="sm"
                class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                @click="togglePasswordVisibility"
              >
                <span class="sr-only">
                  {{ showPassword ? 'Hide value' : 'Show value' }}
                </span>
                <Eye v-if="!showPassword" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </Button>
            </div>

            <div v-if="formErrors.value" class="text-sm text-destructive">
              {{ formErrors.value }}
            </div>
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" @click="closeEditModal">
              Cancel
            </Button>
            <Button
              type="submit"
              :disabled="isSubmitting"
            >
              <Spinner v-if="isSubmitting" class="mr-2" />
              Save
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
</template>
