<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { useSettingsForm } from '@/composables/useSettingsForm'
import { useConnectionTest } from '@/composables/useConnectionTest'
import type { SettingsComponentProps, SettingsComponentEvents } from '@/composables/useSettingsComponentRegistry'
import { DsCard } from '@/components/ui/ds-card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const props = defineProps<SettingsComponentProps>()
const emit = defineEmits<SettingsComponentEvents>()

// Use i18n
const { t } = useI18n()

// Use the settings form composable
const {
  formValues,
  isSaving,
  saveForm,
  updateField,
  getFieldError
} = useSettingsForm(props.settings)

// Use the connection test composable
const {
  isTestingConnection,
  testGitHubAppConnection
} = useConnectionTest()

// Check if we can test the connection (all required fields filled)
const canTestConnection = computed(() => {
  return !!(
    formValues.value['github.app.app_id'] &&
    formValues.value['github.app.private_key_base64'] &&
    formValues.value['github.app.installation_id']
  )
})

// Handle form submission
async function handleSave() {
  const success = await saveForm()
  if (success) {
    emit('settings-updated', props.settings)
  }
}

// Handle connection test
async function handleTestConnection() {
  const result = await testGitHubAppConnection()

  if (result.success) {
    toast.success(t('githubApp.connectionTest.status.success'), {
      description: t('githubApp.connectionTest.status.successDescription')
    })
  } else {
    toast.error(t('githubApp.connectionTest.status.failed'), {
      description: result.message
    })
  }

  emit('connection-tested', result)
}

// Get setting by key
function getSetting(key: string) {
  return props.settings.find(s => s.key === key)
}
</script>

<template>
  <div class="space-y-6">
    <!-- GitHub App Configuration Card -->
    <DsCard :title="props.group.name">
      <p v-if="props.group.description" class="text-sm text-muted-foreground mb-6">
        {{ props.group.description }}
      </p>

      <div class="space-y-6">
        <!-- App ID Field -->
        <div class="space-y-2">
          <Label for="app-id">
            {{ getSetting('github.app.app_id')?.description || t('githubApp.fields.appId.label') }}
          </Label>
          <Input
            id="app-id"
            :model-value="String(formValues['github.app.app_id'] || '')"
            @update:model-value="(value) => updateField('github.app.app_id', value)"
            :placeholder="t('githubApp.fields.appId.placeholder')"
            :class="{ 'border-destructive': getFieldError('github.app.app_id') }"
          />
          <p v-if="getFieldError('github.app.app_id')" class="text-sm text-destructive">
            {{ getFieldError('github.app.app_id') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('githubApp.fields.appId.description') }}
          </p>
        </div>

        <!-- Private Key Field -->
        <div class="space-y-2">
          <Label for="private-key">
            {{ getSetting('github.app.private_key_base64')?.description || t('githubApp.fields.privateKey.label') }}
          </Label>
          <Input
            id="private-key"
            type="password"
            :model-value="String(formValues['github.app.private_key_base64'] || '')"
            @update:model-value="(value) => updateField('github.app.private_key_base64', value)"
            :placeholder="t('githubApp.fields.privateKey.placeholder')"
            :class="{ 'border-destructive': getFieldError('github.app.private_key_base64') }"
          />
          <p v-if="getFieldError('github.app.private_key_base64')" class="text-sm text-destructive">
            {{ getFieldError('github.app.private_key_base64') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('githubApp.fields.privateKey.description') }}
          </p>
        </div>

        <!-- Installation ID Field -->
        <div class="space-y-2">
          <Label for="installation-id">
            {{ getSetting('github.app.installation_id')?.description || t('githubApp.fields.installationId.label') }}
          </Label>
          <Input
            id="installation-id"
            :model-value="String(formValues['github.app.installation_id'] || '')"
            @update:model-value="(value) => updateField('github.app.installation_id', value)"
            :placeholder="t('githubApp.fields.installationId.placeholder')"
            :class="{ 'border-destructive': getFieldError('github.app.installation_id') }"
          />
          <p v-if="getFieldError('github.app.installation_id')" class="text-sm text-destructive">
            {{ getFieldError('github.app.installation_id') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ t('githubApp.fields.installationId.description') }}
          </p>
        </div>

        <!-- Enable Checkbox -->
        <div class="flex items-start gap-3">
          <Checkbox
            id="enabled"
            :checked="Boolean(formValues['github.app.enabled'])"
            @update:checked="(value: boolean) => updateField('github.app.enabled', value)"
          />
          <div class="grid gap-1">
            <label
              for="enabled"
              class="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {{ getSetting('github.app.enabled')?.name || t('githubApp.fields.enabled.label') }}
            </label>
            <p class="text-muted-foreground text-sm">
              {{ getSetting('github.app.enabled')?.description || t('githubApp.fields.enabled.description') }}
            </p>
          </div>
        </div>
      </div>

      <template #footer-status>
        <a
          href="https://docs.deploystack.io/general/github-application"
          target="_blank"
          class="link"
        >
          Learn more about GitHub App configuration
        </a>
      </template>

      <template #footer-actions>
        <Button
          :disabled="isSaving"
          @click="handleSave"
        >
          <Spinner v-if="isSaving" class="mr-2" />
          {{ t('githubApp.form.saveChanges') }}
        </Button>
      </template>
    </DsCard>

    <!-- Connection Test Card -->
    <DsCard :title="t('githubApp.connectionTest.title')">
      <p class="text-sm text-muted-foreground">
        {{ t('githubApp.connectionTest.description') }} Testing becomes available when all required GitHub App fields are configured.
      </p>

      <template #footer-actions>
        <Button
          @click="handleTestConnection"
          :disabled="!canTestConnection || isTestingConnection"
          variant="outline"
        >
          <Spinner v-if="isTestingConnection" class="mr-2" />
          {{ t('githubApp.connectionTest.button.test') }}
        </Button>
      </template>
    </DsCard>
  </div>
</template>
