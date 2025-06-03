<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Separator } from '@/components/ui/separator' // Adjusted path
import GlobalSettingsSidebarNav, { type GlobalSettingGroup } from '@/components/settings/GlobalSettingsSidebarNav.vue'
import DashboardLayout from '@/components/DashboardLayout.vue' // Reinstated
import { getEnv } from '@/utils/env'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2Icon, XIcon } from 'lucide-vue-next' // Added XIcon

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
  console.log(`Fetching all global setting groups with settings from ${apiUrl}/api/settings/groups...`)
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
    console.error('Failed to fetch setting groups:', err)
    error.value = err instanceof Error ? err.message : 'An unknown error occurred'
    settingGroups.value = [] // Clear or set to empty on error
  } finally {
    isLoading.value = false
  }
})

const currentGroupId = computed(() => {
  const groupId = route.params.groupId as string | undefined;
  console.log('[GlobalSettings.vue] Route param groupId:', groupId);
  return groupId;
})

const selectedGroup = computed(() => {
  if (!currentGroupId.value || settingGroups.value.length === 0) {
    console.log('[GlobalSettings.vue] selectedGroup: No currentGroupId or no settingGroups.');
    return null
  }
  const group = settingGroups.value.find(g => g.id === currentGroupId.value)
  if (group) {
    console.log('[GlobalSettings.vue] selectedGroup: Found group:', group.name);
  } else {
    console.log('[GlobalSettings.vue] selectedGroup: Group not found for id:', currentGroupId.value);
  }
  return group
})

// For editable form
import { type Setting } from '@/components/settings/GlobalSettingsSidebarNav.vue' // Import Setting interface
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label' // Using Label directly for now, can switch to Form components later
// import { Switch } from '@/components/ui/switch' // For boolean settings later
// VeeValidate and Zod for later, more complex validation
// import { toTypedSchema } from '@vee-validate/zod'
// import { useForm } from 'vee-validate'
// import * as z from 'zod'

const editableSettings = ref<Setting[]>([])

watch(() => selectedGroup.value, (newGroup) => { // Removed explicit type for newGroup
  if (newGroup && newGroup.settings) {
    editableSettings.value = JSON.parse(JSON.stringify(newGroup.settings))
  } else {
    editableSettings.value = []
  }
}, { immediate: true, deep: true })

function getSettingInputType(setting: Setting): string {
  if (setting.is_encrypted) {
    return 'password'
  }
  // Add more logic here if type information is available (e.g., for numbers, booleans using Switch)
  // For now, default to text.
  // Example: if (setting.value_type === 'boolean') return 'checkbox'; (would need Switch component)
  // if (typeof setting.value === 'number') return 'number';
  return 'text'
}

async function handleSaveChanges() {
  if (!selectedGroup.value) return // selectedGroup itself could be null

  const originalSettings = selectedGroup.value.settings
  if (!originalSettings) return // No original settings to compare against

  const changedSettings = editableSettings.value.filter((editedSetting, index) => {
    const originalSetting = originalSettings[index]
    return originalSetting && editedSetting.value !== originalSetting.value
  })

  if (changedSettings.length === 0) {
    // console.log('No changes to save.') // Removed console log
    successAlertMessage.value = t('globalSettings.alerts.noChanges'); // New i18n key
    showSuccessAlert.value = true;
    // setTimeout for this specific alert could be added if desired, or rely on manual close
    return
  }

  console.log('Saving changed settings:', changedSettings)

  // Prepare settings for bulk update, ensuring all necessary fields are present
  const settingsToUpdate = changedSettings.map(setting => {
    // Find the original setting to get all its properties, as changedSettings might only have key/value
    const originalFullSetting = selectedGroup.value?.settings?.find(s => s.key === setting.key)
    return {
      key: setting.key,
      value: setting.value,
      group_id: selectedGroup.value?.id, // Add group_id
      description: originalFullSetting?.description, // Preserve description
      is_encrypted: originalFullSetting?.is_encrypted, // Preserve encryption status
    }
  })

  try {
    if (!apiUrl) {
      throw new Error('VITE_DEPLOYSTACK_BACKEND_URL is not configured for saving settings.')
    }
    const response = await fetch(`${apiUrl}/api/settings/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add Authorization header if needed: 'Authorization': `Bearer ${yourAuthToken}`
      },
      credentials: 'include', // Added credentials include
      body: JSON.stringify({ settings: settingsToUpdate }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Failed to save settings: ${response.statusText} (status: ${response.status})`)
    }

    const result = await response.json()
    if (!result.success) {
      // Handle cases where API returns success: false but HTTP status is 200
      throw new Error(result.message || 'Failed to save settings due to an API error.')
    }

    console.log('API Save Result:', result)
    // Successfully saved, now update the local state to reflect changes
    // This ensures the UI is in sync without needing an immediate refetch.
    const groupIndex = settingGroups.value.findIndex(g => g.id === selectedGroup.value?.id)
    if (groupIndex !== -1) {
      // Create a new copy of the group with updated settings
      const updatedGroup = {
        ...settingGroups.value[groupIndex],
        settings: JSON.parse(JSON.stringify(editableSettings.value)) // Use the edited settings
      }
      // Replace the old group with the updated one
      const newSettingGroups = [...settingGroups.value]
      newSettingGroups[groupIndex] = updatedGroup
      settingGroups.value = newSettingGroups
    }
    console.log('Settings saved successfully via API.')
    successAlertMessage.value = t('globalSettings.alerts.saveSuccess'); // Assuming you have i18n keys
    showSuccessAlert.value = true;
    // Removed setTimeout to make the alert persistent until manually closed or next save

    // Optionally, use a toast notification for success
    // e.g., toast({ title: 'Settings Saved', description: 'Your changes have been successfully saved.' })

    // Optionally, refetch all groups to ensure data consistency,
    // or merge changes carefully if the API returns the updated settings.
    // For now, the local update above handles immediate UI feedback.
    // await fetchSettingGroupsApi().then(data => settingGroups.value = data); // Example refetch

  } catch (saveError) {
    console.error('Failed to save settings via API:', saveError)
    // Optionally, use a toast notification for error
    // e.g., toast({ title: 'Error Saving Settings', description: (saveError as Error).message, variant: 'destructive' })
  }
}

</script>

<template>
  <DashboardLayout :title="t('globalSettings.title')">
    <div class="hidden space-y-6 p-10 pb-16 md:block">
      <Alert v-if="showSuccessAlert" variant="default" class="mb-4 border-green-500 bg-green-50 text-green-700 relative">
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

      <div class="space-y-0.5">
        <h2 class="text-2xl font-bold tracking-tight">
        {{ t('globalSettings.title') }}
      </h2>
      <p class="text-muted-foreground">
        {{ t('globalSettings.description') }}
      </p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="-mx-4 lg:w-1/5">
        <GlobalSettingsSidebarNav :groups="settingGroups" />
      </aside>
      <div class="flex-1 lg:max-w-2xl">
        <div v-if="isLoading" class="text-muted-foreground">Loading settings...</div>
        <div v-else-if="error" class="text-red-500">Error loading settings: {{ error }}</div>
        <div v-else-if="selectedGroup" class="space-y-6">
          <div>
            <h3 class="text-lg font-medium">
              {{ selectedGroup.name }}
            </h3>
            <p v-if="selectedGroup.description" class="text-sm text-muted-foreground">
              {{ selectedGroup.description }}
            </p>
          </div>
          <Separator />
          <form v-if="editableSettings.length > 0" class="space-y-6" @submit.prevent="handleSaveChanges">
            <div v-for="(setting, index) in editableSettings" :key="setting.key" class="space-y-2">
              <Label :for="`setting-${setting.key}`">{{ setting.description || setting.key }}</Label>
              <Input
                :id="`setting-${setting.key}`"
                :type="getSettingInputType(setting)"
                v-model="editableSettings[index].value"
                class="w-full"
              />
              <p v-if="setting.is_encrypted" class="text-xs text-muted-foreground">This value is encrypted.</p>
              <!-- Add FormDescription and FormMessage here if using full VeeValidate structure -->
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
