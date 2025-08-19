<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Settings, Edit, MoreHorizontal, Eye, EyeOff, Lock } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { TeamService } from '@/services/teamService'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  canEdit?: boolean
  userRole?: 'team_admin' | 'team_user' | null
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: true,
  userRole: null
})

// Emits
const emit = defineEmits<{
  'installation-updated': [installation: McpInstallation]
}>()
const { t } = useI18n()

// Modal state
const isEditModalOpen = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const editingVariable = ref<any>(null)
const editingValue = ref('')
const showPassword = ref(false)
const isSubmitting = ref(false)
const formErrors = ref<Record<string, string>>({})

// Installation-specific computed properties
const displayUserEnvironmentVariables = computed(() => {
  return props.installation?.user_environment_variables || {}
})

const hasEnvironmentVariables = computed(() => {
  // Show the table if there are environment variables defined in the server OR if user has set values
  const hasServerEnvVars = (props.installation?.server?.environment_variables?.length ?? 0) > 0
  const hasUserValues = Object.keys(displayUserEnvironmentVariables.value).length > 0
  return hasServerEnvVars || hasUserValues
})

// Get environment variables with their definitions from server data
const environmentVariablesWithData = computed(() => {
  const userVars = displayUserEnvironmentVariables.value
  const serverEnvVars = props.installation?.server?.environment_variables || []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return serverEnvVars.map((serverVar: any) => {
    return {
      ...serverVar,
      currentValue: userVars[serverVar.name] || ''
    }
  })
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const openEditModal = (variable: any) => {
  // Check if user has permission to edit
  if (!props.canEdit) {
    return
  }

  editingVariable.value = variable
  editingValue.value = variable.currentValue
  showPassword.value = false
  formErrors.value = {}
  isEditModalOpen.value = true
}

const closeEditModal = () => {
  isEditModalOpen.value = false
  editingVariable.value = null
  editingValue.value = ''
  showPassword.value = false
  formErrors.value = {}
}

const togglePasswordVisibility = () => {
  showPassword.value = !showPassword.value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getInputType = (variable: any) => {
  if (variable.type === 'password' && !showPassword.value) {
    return 'password'
  }
  return 'text'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isTextarea = (variable: any) => {
  return variable.type === 'textarea' ||
         (variable.description && variable.description.toLowerCase().includes('json')) ||
         (variable.placeholder && variable.placeholder.length > 100)
}

const validateForm = () => {
  const errors: Record<string, string> = {}

  if (editingVariable.value?.required && !editingValue.value.trim()) {
    errors.value = t('mcpInstallations.details.environmentVariables.edit.validationRules.required')
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const handleSubmit = async () => {
  if (!validateForm()) {
    return
  }

  isSubmitting.value = true

  try {
    // Get current team
    const teams = await TeamService.getUserTeams()
    if (!teams || teams.length === 0) {
      throw new Error('No team found')
    }

    const currentTeam = teams[0] // Use first team for now
    if (!currentTeam) {
      throw new Error('No team available')
    }

    // Create updated environment variables object
    const updatedEnvVars = {
      ...props.installation.user_environment_variables,
      [editingVariable.value.name]: editingValue.value
    }

    // Call API to update environment variables
    const updatedInstallation = await McpInstallationService.updateEnvironmentVariables(
      currentTeam.id,
      props.installation.id,
      updatedEnvVars
    )

    // Update the installation prop with the response data
    Object.assign(props.installation, updatedInstallation)

    // Emit update event
    emit('installation-updated', updatedInstallation)

    // Show success toast
    toast.success(t('mcpInstallations.details.environmentVariables.updateSuccess', { name: editingVariable.value.name }), {
      description: t('mcpInstallations.details.environmentVariables.updated')
    })

    closeEditModal()
  } catch (error) {
    console.error('Error updating environment variable:', error)
    formErrors.value.general = error instanceof Error ? error.message : 'Failed to update environment variable. Please try again.'
  } finally {
    isSubmitting.value = false
  }
}

const modalTitle = computed(() => {
  return editingVariable.value
    ? t('mcpInstallations.details.environmentVariables.edit.title', { name: editingVariable.value.name })
    : ''
})
</script>

<template>
  <div>
    <div class="px-4 sm:px-0">
      <h3 class="text-base/7 font-semibold text-gray-900">{{ t('mcpInstallations.details.environmentVariables.title') }}</h3>
      <p class="mt-1 max-w-2xl text-sm/6 text-gray-500">{{ t('mcpInstallations.details.environmentVariables.description') }}</p>
    </div>

    <div class="mt-6 border-t border-gray-100">
      <!-- Environment Variables Table -->
      <div v-if="hasEnvironmentVariables" class="px-4 py-6 sm:px-0">
        <div class="overflow-hidden">
          <table class="w-full text-left">
            <thead class="sr-only">
              <tr>
                <th>{{ t('mcpInstallations.details.environmentVariables.table.name') }}</th>
                <th class="hidden sm:table-cell">{{ t('mcpInstallations.details.environmentVariables.table.properties') }}</th>
                <th class="hidden sm:table-cell">{{ t('mcpInstallations.details.environmentVariables.table.details') }}</th>
                <th class="hidden sm:table-cell">{{ t('mcpInstallations.details.environmentVariables.table.value') }}</th>
                <th>{{ t('mcpInstallations.details.environmentVariables.table.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="variable in environmentVariablesWithData" :key="variable.name">
                <td class="relative py-5 pr-6">
                  <div class="flex gap-x-6">
                    <div class="flex-auto">
                      <div class="flex items-start gap-x-3">
                        <div class="text-sm/6 font-semibold text-gray-900 font-mono">
                          {{ variable.name }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="absolute right-full bottom-0 h-px w-screen bg-gray-100" />
                  <div class="absolute bottom-0 left-0 h-px w-screen bg-gray-100" />
                </td>
                <td class="hidden py-5 pr-6 sm:table-cell">
                  <div class="space-y-1">
                    <div class="text-xs/5 text-gray-500">
                      <span class="font-medium">{{ t('mcpInstallations.details.environmentVariables.table.required') }}:</span>
                      <Badge :variant="variable.required ? 'default' : 'secondary'" class="ml-1">
                        {{ variable.required ? t('labels.yes') : t('labels.no') }}
                      </Badge>
                    </div>
                    <div v-if="variable.type" class="text-xs/5 text-gray-500">
                      <span class="font-medium">{{ t('mcpInstallations.details.environmentVariables.table.type') }}:</span>
                      <Badge variant="outline" class="ml-1 font-mono text-xs">
                        {{ variable.type }}
                      </Badge>
                    </div>
                  </div>
                </td>
                <td class="hidden py-5 pr-6 sm:table-cell">
                  <div v-if="variable.description" class="text-sm/6 text-gray-900">
                    {{ variable.description }}
                  </div>
                  <div v-if="variable.placeholder" class="mt-1 text-xs/5 text-gray-500">
                    {{ t('mcpInstallations.details.environmentVariables.table.placeholder') }}: {{ variable.placeholder }}
                  </div>
                </td>
                <td class="hidden py-5 pr-6 sm:table-cell">
                  <div class="max-w-xs">
                    <code v-if="variable.type === 'password'" class="bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono text-xs break-all">
                      {{ variable.currentValue ? '••••••••' : t('mcpInstallations.details.environmentVariables.table.notSet') }}
                    </code>
                    <code v-else class="bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono text-xs break-all">
                      {{ variable.currentValue || t('mcpInstallations.details.environmentVariables.table.notSet') }}
                    </code>
                  </div>
                </td>
                <td class="py-5 text-right">
                  <div class="flex justify-end">
                    <TooltipProvider v-if="!canEdit">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            variant="ghost"
                            class="h-8 w-8 p-0 cursor-not-allowed opacity-50"
                            disabled
                          >
                            <span class="sr-only">{{ t('mcpInstallations.details.environmentVariables.table.editDisabled') }}</span>
                            <Lock class="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{{ t('mcpInstallations.details.environmentVariables.table.editDisabledTooltip') }}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <DropdownMenu v-else>
                      <DropdownMenuTrigger as-child>
                        <Button variant="ghost" class="h-8 w-8 p-0">
                          <span class="sr-only">{{ t('mcpInstallations.details.environmentVariables.table.openMenu') }} {{ variable.name }}</span>
                          <MoreHorizontal class="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click="openEditModal(variable)">
                          <Edit class="mr-2 h-4 w-4" />
                          {{ t('mcpInstallations.details.environmentVariables.table.editValue') }}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="px-4 py-12 sm:px-0 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
          <Settings class="h-6 w-6 text-gray-400" />
        </div>
        <h3 class="text-sm font-medium text-gray-900 mb-2">{{ t('mcpInstallations.details.environmentVariables.noVariables.title') }}</h3>
        <p class="text-sm text-gray-500 max-w-sm mx-auto">
          {{ t('mcpInstallations.details.environmentVariables.noVariables.description') }}
        </p>
      </div>
    </div>

    <!-- Edit Environment Variable Modal -->
    <AlertDialog :open="isEditModalOpen" @update:open="(value) => isEditModalOpen = value">
      <AlertDialogContent class="sm:max-w-[500px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t('mcpInstallations.details.environmentVariables.edit.description') }}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <!-- Variable Info -->
          <div v-if="editingVariable" class="bg-gray-50 rounded-lg p-4 space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-gray-700">{{ t('mcpInstallations.details.environmentVariables.edit.variableName') }}:</span>
              <code class="bg-gray-200 text-gray-800 px-2 py-1 rounded font-mono text-xs font-semibold">
                {{ editingVariable.name }}
              </code>
              <Badge v-if="editingVariable.required" variant="default" class="text-xs">
                {{ t('labels.required') }}
              </Badge>
            </div>
            <div v-if="editingVariable.description" class="text-sm text-gray-600">
              {{ editingVariable.description }}
            </div>
          </div>

          <!-- General Error -->
          <div v-if="formErrors.general" class="text-sm text-destructive">
            {{ formErrors.general }}
          </div>

          <!-- Value Input -->
          <div class="space-y-2">
            <Label for="env-value">{{ t('mcpInstallations.details.environmentVariables.edit.newValue') }}</Label>

            <!-- Textarea for long values -->
            <div v-if="editingVariable && isTextarea(editingVariable)" class="relative">
              <Textarea
                id="env-value"
                v-model="editingValue"
                :placeholder="editingVariable.placeholder || t('mcpInstallations.details.environmentVariables.edit.valuePlaceholder')"
                class="min-h-[100px]"
                :class="{ 'border-destructive': formErrors.value }"
                :required="editingVariable.required"
              />
            </div>

            <!-- Regular input -->
            <div v-else class="relative">
              <Input
                id="env-value"
                :type="editingVariable ? getInputType(editingVariable) : 'text'"
                v-model="editingValue"
                :placeholder="editingVariable?.placeholder || t('mcpInstallations.details.environmentVariables.edit.valuePlaceholder')"
                :class="{ 'border-destructive': formErrors.value }"
                :required="editingVariable?.required"
              />

              <!-- Password toggle -->
              <Button
                v-if="editingVariable?.type === 'password'"
                type="button"
                variant="ghost"
                size="sm"
                class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                @click="togglePasswordVisibility"
              >
                <span class="sr-only">
                  {{ showPassword ? t('mcpInstallations.details.environmentVariables.edit.hideValue') : t('mcpInstallations.details.environmentVariables.edit.showValue') }}
                </span>
                <Eye v-if="!showPassword" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </Button>
            </div>

            <div v-if="formErrors.value" class="text-sm text-destructive">
              {{ formErrors.value }}
            </div>
          </div>

          <!-- Validation info -->
          <div v-if="editingVariable?.validation" class="text-xs text-muted-foreground">
            <span class="font-medium">{{ t('mcpInstallations.details.environmentVariables.edit.validation') }}:</span> {{ editingVariable.validation }}
          </div>

          <AlertDialogFooter>
            <Button type="button" variant="outline" @click="closeEditModal">
              {{ t('actions.cancel') }}
            </Button>
            <Button type="submit" :disabled="isSubmitting">
              {{ isSubmitting ? t('actions.saving') : t('actions.save') }}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
