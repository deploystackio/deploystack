<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useEventBus } from '@/composables/useEventBus'
import GlobalSettingsSidebarNav, { type GlobalSettingGroup } from '@/components/settings/GlobalSettingsSidebarNav.vue'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getEnv } from '@/utils/env'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getSettingsComponent } from '@/composables/useSettingsComponentRegistry'

const { t } = useI18n()
const route = useRoute()

const settingGroups = ref<GlobalSettingGroup[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)


const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || '' // Fallback to empty string if not set

// Placeholder for the actual API call
async function fetchSettingGroupsApi(): Promise<GlobalSettingGroup[]> {
  if (!apiUrl) {
    throw new Error(t('globalSettings.errors.configNotSet'))
  }
  const response = await fetch(`${apiUrl}/api/settings/groups`, { credentials: 'include' })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `${t('globalSettings.errors.fetchFailed')}: ${response.statusText} (status: ${response.status})`)
  }

  const result = await response.json()
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error('API response for setting groups was not successful or data format is incorrect.')
  }

  // Data should be an array of GlobalSettingGroup objects, already sorted by backend if getAllGroupMetadata sorts.
  // The service method GlobalSettingsService.getAllGroupMetadata sorts by sort_order, then name.
  // The frontend GlobalSettingGroup type includes 'settings' as optional, which matches the backend's GlobalSettingGroupWithSettings.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result.data.map((g: any) => ({
    ...g,
    settings: g.settings || [] // Ensure settings array exists
  })) as GlobalSettingGroup[];
}

onMounted(async () => {
  try {
    isLoading.value = true
    const fetchedGroups = await fetchSettingGroupsApi() // fetchSettingGroupsApi now returns fully typed GlobalSettingGroup[]
    settingGroups.value = fetchedGroups // Direct assignment is fine now
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('globalSettings.errors.unknownError')
    settingGroups.value = [] // Clear or set to empty on error
  } finally {
    isLoading.value = false
  }
})

const currentGroupId = computed(() => {
  const groupId = route.params.groupId as string | undefined;
  return groupId;
})

const selectedGroup = computed(() => {
  if (!currentGroupId.value || settingGroups.value.length === 0) {
    return null
  }
  const group = settingGroups.value.find(g => g.id === currentGroupId.value)
  return group
})

// Check if the selected group has a custom component
const customComponent = computed(() => {
  if (!selectedGroup.value) return null
  return getSettingsComponent(selectedGroup.value.id)
})

// Event bus for cross-component communication
const eventBus = useEventBus()

// Handle settings updated from custom components
function handleSettingsUpdated(updatedSettings: Setting[]) {
  if (!selectedGroup.value) return

  // Update the local state
  const groupIndex = settingGroups.value.findIndex(g => g.id === selectedGroup.value?.id)
  if (groupIndex !== -1) {
    const updatedGroup = {
      ...settingGroups.value[groupIndex],
      settings: updatedSettings
    }

    const newSettingGroups = [...settingGroups.value]
    newSettingGroups[groupIndex] = updatedGroup
    settingGroups.value = newSettingGroups
  }

  // Show success message with Sonner toast
  toast.success(t('globalSettings.alerts.successTitle'), {
    description: t('globalSettings.alerts.saveSuccess')
  })

  // Emit event for other components
  eventBus.emit('settings-updated')
}

// Handle connection test results from custom components
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleConnectionTested(result: { success: boolean; message: string }) {
  // You can add global handling for connection test results here
  // Connection test results are handled by individual components
}

// For editable form
import { type Setting } from '@/components/settings/GlobalSettingsSidebarNav.vue' // Import Setting interface
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

// Reactive form values
const formValues = ref<Record<string, string | number | boolean>>({})

// Create initial form values from settings
function createInitialValues(settings: Setting[]) {
  const values: Record<string, string | number | boolean> = {}
  settings.forEach(setting => {
    // Handle cases where setting.value might be undefined
    const settingValue = setting.value ?? ''

    switch (setting.type) {
      case 'number':
        values[setting.key] = settingValue ? Number(settingValue) : 0
        break
      case 'boolean':
        // Handle both string and boolean values robustly
        if (typeof settingValue === 'string') {
          values[setting.key] = settingValue.toLowerCase() === 'true'
        } else {
          values[setting.key] = Boolean(settingValue)
        }
        break
      case 'string':
      default:
        values[setting.key] = settingValue
        break
    }
  })
  return values
}



// Watch for group changes and set form values
watch(() => selectedGroup.value, (newGroup) => {
  if (newGroup?.settings) {
    const newInitialValues = createInitialValues(newGroup.settings)
    formValues.value = newInitialValues
  }
}, { immediate: true, deep: true })

// Form submission
async function handleSubmit(event: Event) {
  event.preventDefault()

  if (!selectedGroup.value) return

  // Convert form values to API format
  const settingsToUpdate = Object.entries(formValues.value).map(([key, value]) => {
    const setting = selectedGroup.value?.settings?.find(s => s.key === key)

    // Ensure proper type conversion based on setting type
    let typedValue = value
    if (setting?.type === 'boolean') {
      typedValue = Boolean(value)
    } else if (setting?.type === 'number') {
      typedValue = Number(value)
    } else {
      typedValue = String(value)
    }

    return {
      key,
      value: typedValue, // API expects typed values (string, number, boolean)
      type: setting?.type,
      group_id: selectedGroup.value?.id,
      description: setting?.description,
      encrypted: setting?.is_encrypted || false
    }
  })

  try {
    if (!apiUrl) {
      throw new Error(t('globalSettings.errors.savingConfigNotSet'))
    }

    const requestBody = { settings: settingsToUpdate }

    const response = await fetch(`${apiUrl}/api/settings/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || `${t('globalSettings.errors.saveSettings')}: ${response.statusText} (status: ${response.status})`)
    }


     
    const result = await response.json()

    if (!result.success) {
      throw new Error(result.message || t('globalSettings.errors.saveFailed'))
    }
    
    // Show success message with Sonner toast
    toast.success(t('globalSettings.alerts.successTitle'), {
      description: t('globalSettings.alerts.saveSuccess')
    })

    // Update local state
    const groupIndex = settingGroups.value.findIndex(g => g.id === selectedGroup.value?.id)
    if (groupIndex !== -1) {
      const updatedSettings = selectedGroup.value.settings?.map(setting => ({
        ...setting,
        value: String(formValues.value[setting.key])
      }))

      const updatedGroup = {
        ...settingGroups.value[groupIndex],
        settings: updatedSettings
      }

      const newSettingGroups = [...settingGroups.value]
      newSettingGroups[groupIndex] = updatedGroup
      settingGroups.value = newSettingGroups
    }

    // Emit event for other components
    eventBus.emit('settings-updated')

  } catch (err) {
    // Show error toast with meaningful message
    const errorMessage = err instanceof Error ? err.message : t('globalSettings.errors.unknownError')
    toast.error(t('globalSettings.errors.saveSettings'), {
      description: errorMessage
    })
    console.error('Failed to save settings:', err)
  }
}

</script>

<template>
  <DashboardLayout :title="t('globalSettings.title')">
    <div class="hidden space-y-6 pb-16 md:block">

      <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside class="lg:w-1/5">
          <GlobalSettingsSidebarNav :groups="settingGroups" />
        </aside>
        <div class="flex-1 lg:max-w-3xl">

          <div v-if="isLoading" class="text-muted-foreground">{{ t('globalSettings.loading') }}</div>
          <div v-else-if="error" class="text-red-500">{{ t('globalSettings.errors.loadSettings') }}: {{ error }}</div>


          <div v-else-if="selectedGroup" class="space-y-6">
            <!-- Custom Component -->
            <component
              v-if="customComponent"
              :is="customComponent.component"
              :group="selectedGroup"
              :settings="selectedGroup.settings || []"
              @settings-updated="handleSettingsUpdated"
              @connection-tested="handleConnectionTested"
              v-bind="customComponent.props"
            />

            <!-- Fallback: Standard Form (for groups without custom components) -->
            <Card v-else>
              <CardHeader>
                <CardTitle class="text-xl">
                  {{ selectedGroup.name }}
                </CardTitle>
                <CardDescription v-if="selectedGroup.description">
                  {{ selectedGroup.description }}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form v-if="selectedGroup.settings && selectedGroup.settings.length > 0" class="space-y-6" @submit="handleSubmit">
                  <div v-for="setting in selectedGroup.settings" :key="setting.key" class="space-y-2">
                    <Label :for="`setting-${setting.key}`">{{ setting.description || setting.key }}</Label>

                    <!-- String Input (text or password) -->
                    <Input
                      v-if="setting.type === 'string'"
                      :id="`setting-${setting.key}`"
                      :type="setting.is_encrypted ? 'password' : 'text'"
                      v-model="formValues[setting.key] as string"
                      class="w-full"
                    />

                    <!-- Number Input -->
                    <Input
                      v-else-if="setting.type === 'number'"
                      :id="`setting-${setting.key}`"
                      type="number"
                      v-model.number="formValues[setting.key] as number"
                      class="w-full"
                    />

                    <!-- Boolean Toggle Switch -->
                    <div v-else-if="setting.type === 'boolean'">
                      <Switch
                        :id="`setting-${setting.key}`"
                        :model-value="formValues[setting.key] as boolean"
                        @update:model-value="(value: boolean) => {
                          formValues[setting.key] = value
                        }"
                      />
                    </div>

                    <p v-if="setting.is_encrypted" class="text-xs text-muted-foreground">{{ t('globalSettings.form.encryptedValue') }}</p>
                  </div>

                  <Button type="submit">
                    {{ t('globalSettings.form.saveChanges') }}
                  </Button>
                </form>
                <div v-else-if="selectedGroup && (!selectedGroup.settings || selectedGroup.settings.length === 0)">
                  <p class="text-sm text-muted-foreground">{{ t('globalSettings.form.noSettings') }}</p>
                </div>
                <div v-else>
                  <p class="text-sm text-muted-foreground">{{ t('globalSettings.form.groupNotFound') }}</p>
                </div>
              </CardContent>
            </Card>
          </div>


          <div v-else-if="!currentGroupId && settingGroups.length > 0">
            <p class="text-muted-foreground">{{ t('globalSettings.form.selectCategory') }}</p>
          </div>
          <div v-else-if="!currentGroupId && settingGroups.length === 0 && !isLoading">
              <p class="text-muted-foreground">{{ t('globalSettings.form.noGroups') }}</p>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
