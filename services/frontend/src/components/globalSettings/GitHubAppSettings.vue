<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsForm } from '@/composables/useSettingsForm'
import { useConnectionTest } from '@/composables/useConnectionTest'
import type { SettingsComponentProps, SettingsComponentEvents } from '@/composables/useSettingsComponentRegistry'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  TestTube,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-vue-next'

const props = defineProps<SettingsComponentProps>()
const emit = defineEmits<SettingsComponentEvents>()

// Use i18n
const { t } = useI18n()

// Use the settings form composable
const {
  formValues,
  isSaving,
  hasChanges,
  saveForm,
  updateField,
  getFieldError
} = useSettingsForm(props.settings)

// Use the connection test composable
const {
  isTestingConnection,
  lastTestResult,
  testGitHubAppConnection,
  getStatusMessage,
  getAlertVariant
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
  // Test uses saved settings from the backend, no credentials needed
  const result = await testGitHubAppConnection()
  emit('connection-tested', result)
}

// Get setting by key
function getSetting(key: string) {
  return props.settings.find(s => s.key === key)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Configuration Form -->
    <div class="md:hidden">
      <!-- Mobile: Form without Card wrapper -->
      <form @submit.prevent="handleSave" class="space-y-6">
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
                class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                {{ getSetting('github.app.enabled')?.name || t('githubApp.fields.enabled.label') }}
              </label>
              <p class="text-muted-foreground text-sm">
                {{ getSetting('github.app.enabled')?.description || t('githubApp.fields.enabled.description') }}
              </p>
            </div>
          </div>

          <Separator />

          <!-- Connection Test Section -->
          <div class="space-y-4">
            <div class="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div>
                <h4 class="font-medium flex items-center space-x-2">
                  <TestTube class="h-4 w-4" />
                  <span>{{ t('githubApp.connectionTest.title') }}</span>
                </h4>
                <p class="text-sm text-muted-foreground">
                  {{ t('githubApp.connectionTest.description') }}
                </p>
              </div>
              <Button
                type="button"
                @click="handleTestConnection"
                :disabled="!canTestConnection"
                :loading="isTestingConnection"
                variant="outline"
                size="sm"
                class="w-full sm:w-auto"
              >
                <TestTube class="h-4 w-4 mr-2" />
                {{ t('githubApp.connectionTest.button.test') }}
              </Button>
            </div>

            <!-- Connection Status -->
            <Alert v-if="lastTestResult" :variant="getAlertVariant(lastTestResult)">
              <component
                :is="lastTestResult.success ? CheckCircle : XCircle"
                class="h-4 w-4"
              />
              <AlertTitle>
                {{ lastTestResult.success ? t('githubApp.connectionTest.status.success') : t('githubApp.connectionTest.status.failed') }}
              </AlertTitle>
              <AlertDescription>
                {{ getStatusMessage(lastTestResult) }}
              </AlertDescription>
            </Alert>

            <!-- Test Requirements -->
            <div v-if="!canTestConnection" class="flex items-start space-x-2 p-3 bg-muted rounded-lg">
              <Info class="h-4 w-4 text-muted-foreground mt-0.5" />
              <div class="text-sm text-muted-foreground">
                <p class="font-medium">{{ t('githubApp.connectionTest.requirements.title') }}</p>
                <ul class="list-disc list-inside mt-1 space-y-1">
                  <li>{{ t('githubApp.connectionTest.requirements.appId') }}</li>
                  <li>{{ t('githubApp.connectionTest.requirements.privateKey') }}</li>
                  <li>{{ t('githubApp.connectionTest.requirements.installationId') }}</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Save Button -->
          <div class="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div class="flex items-center space-x-2">
              <Badge v-if="hasChanges" variant="outline">
                {{ t('githubApp.form.unsavedChanges') }}
              </Badge>
            </div>
            <Button
              type="submit"
              :disabled="!hasChanges"
              :loading="isSaving"
              class="min-w-[120px] w-full sm:w-auto"
            >
              {{ t('githubApp.form.saveChanges') }}
            </Button>
          </div>
        </form>
      </div>

      <!-- Desktop: Form with Card wrapper -->
      <Card class="hidden md:block">
        <CardHeader class="pb-3">
          <CardTitle>
            {{ props.group.name }}
          </CardTitle>
          <CardDescription v-if="props.group.description">
            {{ props.group.description }}
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent class="pt-10">
          <form @submit.prevent="handleSave" class="space-y-6">
            <!-- App ID Field -->
            <div class="space-y-2">
              <Label for="app-id-desktop">
                {{ getSetting('github.app.app_id')?.description || t('githubApp.fields.appId.label') }}
              </Label>
              <Input
                id="app-id-desktop"
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
              <Label for="private-key-desktop">
                {{ getSetting('github.app.private_key_base64')?.description || t('githubApp.fields.privateKey.label') }}
              </Label>
              <Input
                id="private-key-desktop"
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
              <Label for="installation-id-desktop">
                {{ getSetting('github.app.installation_id')?.description || t('githubApp.fields.installationId.label') }}
              </Label>
              <Input
                id="installation-id-desktop"
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
                id="enabled-desktop"
                :checked="Boolean(formValues['github.app.enabled'])"
                @update:checked="(value: boolean) => updateField('github.app.enabled', value)"
              />
              <div class="grid gap-1">
                <label
                  for="enabled-desktop"
                  class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {{ getSetting('github.app.enabled')?.name || t('githubApp.fields.enabled.label') }}
                </label>
                <p class="text-muted-foreground text-sm">
                  {{ getSetting('github.app.enabled')?.description || t('githubApp.fields.enabled.description') }}
                </p>
              </div>
            </div>

            <Separator />

            <!-- Connection Test Section -->
            <div class="space-y-4">
              <div class="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                  <h4 class="font-medium flex items-center space-x-2">
                    <TestTube class="h-4 w-4" />
                    <span>{{ t('githubApp.connectionTest.title') }}</span>
                  </h4>
                  <p class="text-sm text-muted-foreground">
                    {{ t('githubApp.connectionTest.description') }}
                  </p>
                </div>
                <Button
                  type="button"
                  @click="handleTestConnection"
                  :disabled="!canTestConnection"
                  :loading="isTestingConnection"
                  variant="outline"
                  size="sm"
                  class="w-full sm:w-auto"
                >
                  <TestTube class="h-4 w-4 mr-2" />
                  {{ t('githubApp.connectionTest.button.test') }}
                </Button>
              </div>

              <!-- Connection Status -->
              <Alert v-if="lastTestResult" :variant="getAlertVariant(lastTestResult)">
                <component
                  :is="lastTestResult.success ? CheckCircle : XCircle"
                  class="h-4 w-4"
                />
                <AlertTitle>
                  {{ lastTestResult.success ? t('githubApp.connectionTest.status.success') : t('githubApp.connectionTest.status.failed') }}
                </AlertTitle>
                <AlertDescription>
                  {{ getStatusMessage(lastTestResult) }}
                </AlertDescription>
              </Alert>

              <!-- Test Requirements -->
              <div v-if="!canTestConnection" class="flex items-start space-x-2 p-3 bg-muted rounded-lg">
                <Info class="h-4 w-4 text-muted-foreground mt-0.5" />
                <div class="text-sm text-muted-foreground">
                  <p class="font-medium">{{ t('githubApp.connectionTest.requirements.title') }}</p>
                  <ul class="list-disc list-inside mt-1 space-y-1">
                    <li>{{ t('githubApp.connectionTest.requirements.appId') }}</li>
                    <li>{{ t('githubApp.connectionTest.requirements.privateKey') }}</li>
                    <li>{{ t('githubApp.connectionTest.requirements.installationId') }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <Separator />

            <!-- Save Button -->
            <div class="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div class="flex items-center space-x-2">
                <Badge v-if="hasChanges" variant="outline">
                  {{ t('githubApp.form.unsavedChanges') }}
                </Badge>
              </div>
              <Button
                type="submit"
                :disabled="!hasChanges"
                :loading="isSaving"
                class="min-w-[120px] w-full sm:w-auto"
              >
                {{ t('githubApp.form.saveChanges') }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
</template>
