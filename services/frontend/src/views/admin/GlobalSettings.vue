<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import GlobalSettingsSidebarNav, { type GlobalSettingGroup } from '@/components/settings/GlobalSettingsSidebarNav.vue'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { getEnv } from '@/utils/env'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2Icon, XIcon } from 'lucide-vue-next'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const { t } = useI18n()
const route = useRoute()

const settingGroups = ref<GlobalSettingGroup[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const showSuccessAlert = ref(false)
const successAlertMessage = ref('')

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || '' // Fallback to empty string if not set

// Placeholder for the actual API call
async function fetchSettingGroupsApi(): Promise<GlobalSettingGroup[]> {
  if (!apiUrl) {
    throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured.')
  }
  const response = await fetch(`${apiUrl}/api/settings/groups`, { credentials: 'include' })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to fetch setting groups: ${response.statusText} (status: ${response.status})`)
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
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
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

// Watch for route changes and reset success alert
watch(() => route.params.groupId, () => {
  showSuccessAlert.value = false
})

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
    return {
      key,
      value: value, // API expects typed values (string, number, boolean)
      type: setting?.type,
      group_id: selectedGroup.value?.id,
      description: setting?.description,
      encrypted: setting?.is_encrypted || false
    }
  })

  try {
    if (!apiUrl) {
      throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured for saving settings.')
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
      throw new Error(errorData.error || errorData.message || `Failed to save settings: ${response.statusText} (status: ${response.status})`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.message || 'Failed to save settings due to an API error.')
    }
    successAlertMessage.value = t('globalSettings.alerts.saveSuccess')
    showSuccessAlert.value = true

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

  } catch {
    // Handle save error silently or show user-friendly error message
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

          <Alert v-if="showSuccessAlert" variant="default" class="mb-8 border-green-500 bg-green-50 text-green-700 relative">
            <CheckCircle2Icon class="h-5 w-5 text-green-600" />
            <AlertTitle class="font-semibold text-green-800">{{ t('globalSettings.alerts.successTitle') }}</AlertTitle>
            <AlertDescription>
              {{ successAlertMessage }}
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              class="absolute top-2 right-2 p-1 h-auto text-green-700 hover:bg-green-100"
              @click="showSuccessAlert = false"
              aria-label="Dismiss success alert"
            >
              <XIcon class="h-4 w-4" />
            </Button>
          </Alert>

          <div v-if="isLoading" class="text-muted-foreground">Loading settings...</div>
          <div v-else-if="error" class="text-red-500">Error loading settings: {{ error }}</div>


          <div v-else-if="selectedGroup" class="space-y-6">

            <Card>
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
                        v-model="formValues[setting.key] as boolean"
                      />
                    </div>

                    <p v-if="setting.is_encrypted" class="text-xs text-muted-foreground">This value is encrypted.</p>
                  </div>

                  <Button type="submit">
                    Save Changes
                  </Button>
                </form>
                <div v-else-if="selectedGroup && (!selectedGroup.settings || selectedGroup.settings.length === 0)">
                  <p class="text-sm text-muted-foreground">No settings in this group.</p>
                </div>
                <div v-else>
                  <p class="text-sm text-muted-foreground">Group not found or settings unavailable.</p>
                </div>

              </CardContent>
            </Card>


          </div>


          <div v-else-if="!currentGroupId && settingGroups.length > 0">
            <p class="text-muted-foreground">Select a category from the sidebar to view its settings.</p>
          </div>
          <div v-else-if="!currentGroupId && settingGroups.length === 0 && !isLoading">
              <p class="text-muted-foreground">No setting groups found.</p>
          </div>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
