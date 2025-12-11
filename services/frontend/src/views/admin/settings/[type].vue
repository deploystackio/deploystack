<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import { useEventBus } from '@/composables/useEventBus'
import { SettingsMenu, SettingsMenuGroup, SettingsMenuItem } from '@/components/ui/settings-menu'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import type { GlobalSettingGroup, Setting } from '@/components/globalSettings/GlobalSettingsSidebarNav.vue'
import NavbarLayout from '@/components/NavbarLayout.vue'
import { getEnv } from '@/utils/env'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldDescription } from '@/components/ui/field'
import { DsCard } from '@/components/ui/ds-card'
import { getSettingsComponent } from '@/composables/useSettingsComponentRegistry'

const { t } = useI18n()
const route = useRoute()
const { setBreadcrumbs } = useBreadcrumbs()

const settingGroups = ref<GlobalSettingGroup[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const isSubmitting = ref(false)

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
  setBreadcrumbs([{ label: t('globalSettings.title') }])

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
  const groupId = route.params.type as string | undefined;
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
  if (groupIndex !== -1 && selectedGroup.value) {
    const updatedGroup = {
      ...settingGroups.value[groupIndex],
      id: selectedGroup.value.id,
      name: selectedGroup.value.name,
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

// Reactive form values
const formValues = ref<Record<string, string | number | boolean>>({})

// Update boolean setting value
function updateBooleanValue(key: string, value: boolean) {
  formValues.value[key] = value
}

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

// Utility function to remove trailing slash from URLs
function removeTrailingSlash(url: string): string {
  if (!url || url === '/') return url
  return url.endsWith('/') ? url.slice(0, -1) : url
}

// Check if a setting is the frontend base URL setting
function isFrontendBaseUrlSetting(setting: Setting | undefined): boolean {
  if (!setting) return false

  // Check by description
  if (setting.description?.toLowerCase().includes('base url for the application frontend')) {
    return true
  }

  // Check by common key patterns
  const key = setting.key?.toLowerCase()
  return key === 'frontend_base_url' ||
         key === 'frontend_url' ||
         key === 'app_frontend_url' ||
         key === 'base_frontend_url'
}

// Form submission
async function handleSubmit() {
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

      // Apply URL transformation for frontend base URL setting
      if (isFrontendBaseUrlSetting(setting)) {
        typedValue = removeTrailingSlash(typedValue)
      }
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

  isSubmitting.value = true

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
    if (groupIndex !== -1 && selectedGroup.value) {
      const updatedSettings = selectedGroup.value.settings?.map(setting => ({
        ...setting,
        value: String(formValues.value[setting.key])
      }))

      const updatedGroup = {
        ...settingGroups.value[groupIndex],
        id: selectedGroup.value.id,
        name: selectedGroup.value.name,
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
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <NavbarLayout>
    <DsPageHeading :title="t('globalSettings.title')" />

    <!-- Mobile Navigation - Show tabs on small screens -->
    <div class="block md:hidden mb-6">
      <nav class="flex space-x-1 p-1 bg-muted/50 rounded-lg overflow-x-auto">
        <Button
          v-for="group in settingGroups"
          :key="group.id"
          as-child
          variant="ghost"
          :class="[
            'flex-shrink-0 px-3 py-2 text-sm whitespace-nowrap',
            currentGroupId === group.id && 'bg-background shadow-sm'
          ]"
        >
          <router-link :to="`/admin/settings/${group.id}`">
            {{ group.name }}
          </router-link>
        </Button>
      </nav>
    </div>

    <!-- Main Content -->
    <div class="space-y-6 pb-16">
      <div class="flex flex-col space-y-8 md:flex-row md:space-x-12 md:space-y-0">
        <!-- Desktop Sidebar Navigation -->
        <aside class="hidden md:block w-56 shrink-0">
          <SettingsMenu>
            <SettingsMenuGroup>
              <SettingsMenuItem
                v-for="group in settingGroups"
                :key="group.id"
                :to="`/admin/settings/${group.id}`"
                :active="currentGroupId === group.id"
              >
                {{ group.name }}
              </SettingsMenuItem>
            </SettingsMenuGroup>
          </SettingsMenu>
        </aside>

        <!-- Content Area -->
        <div class="flex-1">

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
            <DsCard v-else :title="selectedGroup.name">
              <p v-if="selectedGroup.description" class="text-sm text-muted-foreground mb-6">
                {{ selectedGroup.description }}
              </p>

              <FieldGroup v-if="selectedGroup.settings && selectedGroup.settings.length > 0">
                <template v-for="setting in selectedGroup.settings" :key="setting.key">
                  <!-- Boolean Checkbox -->
                  <div v-if="setting.type === 'boolean'" class="flex items-start gap-3">
                    <Checkbox
                      :id="`setting-${setting.key}`"
                      :checked="formValues[setting.key] as boolean"
                      @update:checked="(value: boolean) => updateBooleanValue(setting.key, value)"
                    />
                    <div class="grid gap-1">
                      <label
                        :for="`setting-${setting.key}`"
                        class="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {{ setting.name || setting.key }}
                      </label>
                      <p v-if="setting.description" class="text-muted-foreground text-sm">
                        {{ setting.description }}
                      </p>
                    </div>
                  </div>

                  <!-- String/Number Input with Field -->
                  <Field v-else>
                    <FieldLabel :for="`setting-${setting.key}`">
                      {{ setting.name || setting.key }}
                    </FieldLabel>
                    <Input
                      v-if="setting.type === 'string'"
                      :id="`setting-${setting.key}`"
                      :type="setting.is_encrypted ? 'password' : 'text'"
                      v-model="formValues[setting.key] as string"
                    />
                    <Input
                      v-else-if="setting.type === 'number'"
                      :id="`setting-${setting.key}`"
                      type="number"
                      v-model.number="formValues[setting.key] as number"
                    />
                    <FieldDescription v-if="setting.description">
                      {{ setting.description }}
                    </FieldDescription>
                    <p v-if="setting.is_encrypted" class="text-xs text-muted-foreground">
                      {{ t('globalSettings.form.encryptedValue') }}
                    </p>
                  </Field>
                </template>
              </FieldGroup>

              <div v-else-if="!selectedGroup.settings || selectedGroup.settings.length === 0">
                <p class="text-sm text-muted-foreground">{{ t('globalSettings.form.noSettings') }}</p>
              </div>

              <template v-if="selectedGroup.settings && selectedGroup.settings.length > 0" #footer-actions>
                <Button
                  :disabled="isSubmitting"
                  @click="handleSubmit"
                >
                  <Spinner v-if="isSubmitting" class="mr-2" />
                  {{ t('globalSettings.form.saveChanges') }}
                </Button>
              </template>
            </DsCard>
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
  </NavbarLayout>
</template>
