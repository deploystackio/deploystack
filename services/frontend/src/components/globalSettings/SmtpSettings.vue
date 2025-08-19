<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingsForm } from '@/composables/useSettingsForm'
import { useConnectionTest } from '@/composables/useConnectionTest'
import type { SettingsComponentProps, SettingsComponentEvents } from '@/composables/useSettingsComponentRegistry'
import {
  Card,
  CardContent
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  TestTube,
  CheckCircle,
  XCircle,
  Info,
  Mail
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
  testSmtpEmailConnection,
  getStatusMessage,
  getAlertVariant
} = useConnectionTest()

// Test email address
const testEmailAddress = ref('')

// Check if we can test the connection (all required fields filled)
const canTestConnection = computed(() => {
  return !!(
    formValues.value['smtp.enabled'] &&
    formValues.value['smtp.host'] &&
    formValues.value['smtp.port'] &&
    formValues.value['smtp.username'] &&
    formValues.value['smtp.password'] &&
    testEmailAddress.value &&
    isValidEmail(testEmailAddress.value)
  )
})

// Email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Handle form submission
async function handleSave() {
  const success = await saveForm()
  if (success) {
    emit('settings-updated', props.settings)
  }
}

// Handle email test
async function handleTestEmail() {
  if (!canTestConnection.value) return

  const result = await testSmtpEmailConnection(testEmailAddress.value)
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
          <!-- Email Functionality Toggle -->
          <div class="space-y-2">
            <div class="flex items-center space-x-2">
              <Switch
                id="smtp-enabled"
                :model-value="Boolean(formValues['smtp.enabled'])"
                @update:model-value="(value) => updateField('smtp.enabled', value)"
              />
              <Label for="smtp-enabled" class="font-medium">
                {{ getSetting('smtp.enabled')?.description || t('smtp.fields.enabled.label') }}
              </Label>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ t('smtp.fields.enabled.description') }}
            </p>
          </div>

          <Separator />

          <!-- SMTP Host Field -->
          <div class="space-y-2">
            <Label for="smtp-host">
              {{ getSetting('smtp.host')?.description || t('smtp.fields.host.label') }}
            </Label>
            <Input
              id="smtp-host"
              :model-value="String(formValues['smtp.host'] || '')"
              @update:model-value="(value) => updateField('smtp.host', value)"
              :placeholder="t('smtp.fields.host.placeholder')"
              :class="{ 'border-destructive': getFieldError('smtp.host') }"
            />
            <p v-if="getFieldError('smtp.host')" class="text-sm text-destructive">
              {{ getFieldError('smtp.host') }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t('smtp.fields.host.description') }}
            </p>
          </div>

          <!-- SMTP Port Field -->
          <div class="space-y-2">
            <Label for="smtp-port">
              {{ getSetting('smtp.port')?.description || t('smtp.fields.port.label') }}
            </Label>
            <Input
              id="smtp-port"
              type="number"
              :model-value="String(formValues['smtp.port'] || '')"
              @update:model-value="(value) => updateField('smtp.port', value)"
              :placeholder="t('smtp.fields.port.placeholder')"
              :class="{ 'border-destructive': getFieldError('smtp.port') }"
            />
            <p v-if="getFieldError('smtp.port')" class="text-sm text-destructive">
              {{ getFieldError('smtp.port') }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t('smtp.fields.port.description') }}
            </p>
          </div>

          <!-- SMTP Username Field -->
          <div class="space-y-2">
            <Label for="smtp-username">
              {{ getSetting('smtp.username')?.description || t('smtp.fields.username.label') }}
            </Label>
            <Input
              id="smtp-username"
              type="email"
              :model-value="String(formValues['smtp.username'] || '')"
              @update:model-value="(value) => updateField('smtp.username', value)"
              :placeholder="t('smtp.fields.username.placeholder')"
              :class="{ 'border-destructive': getFieldError('smtp.username') }"
            />
            <p v-if="getFieldError('smtp.username')" class="text-sm text-destructive">
              {{ getFieldError('smtp.username') }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t('smtp.fields.username.description') }}
            </p>
          </div>

          <!-- SMTP Password Field -->
          <div class="space-y-2">
            <Label for="smtp-password">
              {{ getSetting('smtp.password')?.description || t('smtp.fields.password.label') }}
            </Label>
            <Input
              id="smtp-password"
              type="password"
              :model-value="String(formValues['smtp.password'] || '')"
              @update:model-value="(value) => updateField('smtp.password', value)"
              :placeholder="t('smtp.fields.password.placeholder')"
              :class="{ 'border-destructive': getFieldError('smtp.password') }"
            />
            <p v-if="getFieldError('smtp.password')" class="text-sm text-destructive">
              {{ getFieldError('smtp.password') }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t('smtp.fields.password.description') }}
            </p>
          </div>

          <!-- SMTP Secure Toggle -->
          <div class="space-y-2">
            <div class="flex items-center space-x-2">
              <Switch
                id="smtp-secure"
                :model-value="Boolean(formValues['smtp.secure'])"
                @update:model-value="(value) => updateField('smtp.secure', value)"
              />
              <Label for="smtp-secure">
                {{ getSetting('smtp.secure')?.description || t('smtp.fields.secure.label') }}
              </Label>
            </div>
            <p class="text-xs text-muted-foreground">
              {{ t('smtp.fields.secure.description') }}
            </p>
          </div>

          <!-- From Name Field -->
          <div class="space-y-2">
            <Label for="smtp-from-name">
              {{ getSetting('smtp.from_name')?.description || t('smtp.fields.fromName.label') }}
            </Label>
            <Input
              id="smtp-from-name"
              :model-value="String(formValues['smtp.from_name'] || '')"
              @update:model-value="(value) => updateField('smtp.from_name', value)"
              :placeholder="t('smtp.fields.fromName.placeholder')"
              :class="{ 'border-destructive': getFieldError('smtp.from_name') }"
            />
            <p v-if="getFieldError('smtp.from_name')" class="text-sm text-destructive">
              {{ getFieldError('smtp.from_name') }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t('smtp.fields.fromName.description') }}
            </p>
          </div>

          <!-- From Email Field -->
          <div class="space-y-2">
            <Label for="smtp-from-email">
              {{ getSetting('smtp.from_email')?.description || t('smtp.fields.fromEmail.label') }}
            </Label>
            <Input
              id="smtp-from-email"
              type="email"
              :model-value="String(formValues['smtp.from_email'] || '')"
              @update:model-value="(value) => updateField('smtp.from_email', value)"
              :placeholder="t('smtp.fields.fromEmail.placeholder')"
              :class="{ 'border-destructive': getFieldError('smtp.from_email') }"
            />
            <p v-if="getFieldError('smtp.from_email')" class="text-sm text-destructive">
              {{ getFieldError('smtp.from_email') }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t('smtp.fields.fromEmail.description') }}
            </p>
          </div>

          <Separator />

          <!-- Email Test Section -->
          <div class="space-y-4">
            <div>
              <h4 class="font-medium flex items-center space-x-2">
                <Mail class="h-4 w-4" />
                <span>{{ t('smtp.emailTest.title') }}</span>
              </h4>
              <p class="text-sm text-muted-foreground">
                {{ t('smtp.emailTest.description') }}
              </p>
            </div>

            <!-- Test Email Address Input -->
            <div class="space-y-2">
              <Label for="test-email">
                {{ t('smtp.emailTest.emailAddress.label') }}
              </Label>
              <Input
                id="test-email"
                type="email"
                v-model="testEmailAddress"
                :placeholder="t('smtp.emailTest.emailAddress.placeholder')"
                :class="{ 'border-destructive': testEmailAddress && !isValidEmail(testEmailAddress) }"
              />
              <p v-if="testEmailAddress && !isValidEmail(testEmailAddress)" class="text-sm text-destructive">
                {{ t('smtp.emailTest.emailAddress.invalid') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('smtp.emailTest.emailAddress.description') }}
              </p>
            </div>

            <!-- Test Button -->
            <Button
              type="button"
              @click="handleTestEmail"
              :disabled="!canTestConnection"
              :loading="isTestingConnection"
              variant="outline"
              size="sm"
              class="w-full sm:w-auto"
            >
              <TestTube class="h-4 w-4 mr-2" />
              {{ t('smtp.emailTest.button.test') }}
            </Button>

            <!-- Test Status -->
            <Alert v-if="lastTestResult" :variant="getAlertVariant(lastTestResult)">
              <component
                :is="lastTestResult.success ? CheckCircle : XCircle"
                class="h-4 w-4"
              />
              <AlertTitle>
                {{ lastTestResult.success ? t('smtp.emailTest.status.success') : t('smtp.emailTest.status.failed') }}
              </AlertTitle>
              <AlertDescription>
                {{ getStatusMessage(lastTestResult) }}
              </AlertDescription>
            </Alert>

            <!-- Test Requirements -->
            <div v-if="!canTestConnection" class="flex items-start space-x-2 p-3 bg-muted rounded-lg">
              <Info class="h-4 w-4 text-muted-foreground mt-0.5" />
              <div class="text-sm text-muted-foreground">
                <p class="font-medium">{{ t('smtp.emailTest.requirements.title') }}</p>
                <ul class="list-disc list-inside mt-1 space-y-1">
                  <li>{{ t('smtp.emailTest.requirements.enabled') }}</li>
                  <li>{{ t('smtp.emailTest.requirements.host') }}</li>
                  <li>{{ t('smtp.emailTest.requirements.port') }}</li>
                  <li>{{ t('smtp.emailTest.requirements.username') }}</li>
                  <li>{{ t('smtp.emailTest.requirements.password') }}</li>
                  <li>{{ t('smtp.emailTest.requirements.testEmail') }}</li>
                </ul>
              </div>
            </div>
          </div>

          <Separator />

          <!-- Save Button -->
          <div class="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div class="flex items-center space-x-2">
              <Badge v-if="hasChanges" variant="outline">
                {{ t('smtp.form.unsavedChanges') }}
              </Badge>
            </div>
            <Button
              type="submit"
              :disabled="!hasChanges"
              :loading="isSaving"
              class="min-w-[120px] w-full sm:w-auto"
            >
              {{ t('smtp.form.saveChanges') }}
            </Button>
          </div>
        </form>
      </div>

      <!-- Desktop: Form with Card wrapper -->
      <Card class="hidden md:block">
        <CardContent class="pt-6">
          <form @submit.prevent="handleSave" class="space-y-6">
            <!-- Email Functionality Toggle -->
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <Switch
                  id="smtp-enabled-desktop"
                  :model-value="Boolean(formValues['smtp.enabled'])"
                  @update:model-value="(value) => updateField('smtp.enabled', value)"
                />
                <Label for="smtp-enabled-desktop" class="font-medium">
                  {{ getSetting('smtp.enabled')?.description || t('smtp.fields.enabled.label') }}
                </Label>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ t('smtp.fields.enabled.description') }}
              </p>
            </div>

            <Separator />

            <!-- SMTP Host Field -->
            <div class="space-y-2">
              <Label for="smtp-host-desktop">
                {{ getSetting('smtp.host')?.description || t('smtp.fields.host.label') }}
              </Label>
              <Input
                id="smtp-host-desktop"
                :model-value="String(formValues['smtp.host'] || '')"
                @update:model-value="(value) => updateField('smtp.host', value)"
                :placeholder="t('smtp.fields.host.placeholder')"
                :class="{ 'border-destructive': getFieldError('smtp.host') }"
              />
              <p v-if="getFieldError('smtp.host')" class="text-sm text-destructive">
                {{ getFieldError('smtp.host') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('smtp.fields.host.description') }}
              </p>
            </div>

            <!-- SMTP Port Field -->
            <div class="space-y-2">
              <Label for="smtp-port-desktop">
                {{ getSetting('smtp.port')?.description || t('smtp.fields.port.label') }}
              </Label>
              <Input
                id="smtp-port-desktop"
                type="number"
                :model-value="String(formValues['smtp.port'] || '')"
                @update:model-value="(value) => updateField('smtp.port', value)"
                :placeholder="t('smtp.fields.port.placeholder')"
                :class="{ 'border-destructive': getFieldError('smtp.port') }"
              />
              <p v-if="getFieldError('smtp.port')" class="text-sm text-destructive">
                {{ getFieldError('smtp.port') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('smtp.fields.port.description') }}
              </p>
            </div>

            <!-- SMTP Username Field -->
            <div class="space-y-2">
              <Label for="smtp-username-desktop">
                {{ getSetting('smtp.username')?.description || t('smtp.fields.username.label') }}
              </Label>
              <Input
                id="smtp-username-desktop"
                type="email"
                :model-value="String(formValues['smtp.username'] || '')"
                @update:model-value="(value) => updateField('smtp.username', value)"
                :placeholder="t('smtp.fields.username.placeholder')"
                :class="{ 'border-destructive': getFieldError('smtp.username') }"
              />
              <p v-if="getFieldError('smtp.username')" class="text-sm text-destructive">
                {{ getFieldError('smtp.username') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('smtp.fields.username.description') }}
              </p>
            </div>

            <!-- SMTP Password Field -->
            <div class="space-y-2">
              <Label for="smtp-password-desktop">
                {{ getSetting('smtp.password')?.description || t('smtp.fields.password.label') }}
              </Label>
              <Input
                id="smtp-password-desktop"
                type="password"
                :model-value="String(formValues['smtp.password'] || '')"
                @update:model-value="(value) => updateField('smtp.password', value)"
                :placeholder="t('smtp.fields.password.placeholder')"
                :class="{ 'border-destructive': getFieldError('smtp.password') }"
              />
              <p v-if="getFieldError('smtp.password')" class="text-sm text-destructive">
                {{ getFieldError('smtp.password') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('smtp.fields.password.description') }}
              </p>
            </div>

            <!-- SMTP Secure Toggle -->
            <div class="space-y-2">
              <div class="flex items-center space-x-2">
                <Switch
                  id="smtp-secure-desktop"
                  :model-value="Boolean(formValues['smtp.secure'])"
                  @update:model-value="(value) => updateField('smtp.secure', value)"
                />
                <Label for="smtp-secure-desktop">
                  {{ getSetting('smtp.secure')?.description || t('smtp.fields.secure.label') }}
                </Label>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ t('smtp.fields.secure.description') }}
              </p>
            </div>

            <!-- From Name Field -->
            <div class="space-y-2">
              <Label for="smtp-from-name-desktop">
                {{ getSetting('smtp.from_name')?.description || t('smtp.fields.fromName.label') }}
              </Label>
              <Input
                id="smtp-from-name-desktop"
                :model-value="String(formValues['smtp.from_name'] || '')"
                @update:model-value="(value) => updateField('smtp.from_name', value)"
                :placeholder="t('smtp.fields.fromName.placeholder')"
                :class="{ 'border-destructive': getFieldError('smtp.from_name') }"
              />
              <p v-if="getFieldError('smtp.from_name')" class="text-sm text-destructive">
                {{ getFieldError('smtp.from_name') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('smtp.fields.fromName.description') }}
              </p>
            </div>

            <!-- From Email Field -->
            <div class="space-y-2">
              <Label for="smtp-from-email-desktop">
                {{ getSetting('smtp.from_email')?.description || t('smtp.fields.fromEmail.label') }}
              </Label>
              <Input
                id="smtp-from-email-desktop"
                type="email"
                :model-value="String(formValues['smtp.from_email'] || '')"
                @update:model-value="(value) => updateField('smtp.from_email', value)"
                :placeholder="t('smtp.fields.fromEmail.placeholder')"
                :class="{ 'border-destructive': getFieldError('smtp.from_email') }"
              />
              <p v-if="getFieldError('smtp.from_email')" class="text-sm text-destructive">
                {{ getFieldError('smtp.from_email') }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ t('smtp.fields.fromEmail.description') }}
              </p>
            </div>

            <Separator />

            <!-- Email Test Section -->
            <div class="space-y-4">
              <div>
                <h4 class="font-medium flex items-center space-x-2">
                  <Mail class="h-4 w-4" />
                  <span>{{ t('smtp.emailTest.title') }}</span>
                </h4>
                <p class="text-sm text-muted-foreground">
                  {{ t('smtp.emailTest.description') }}
                </p>
              </div>

              <!-- Test Email Address Input -->
              <div class="space-y-2">
                <Label for="test-email-desktop">
                  {{ t('smtp.emailTest.emailAddress.label') }}
                </Label>
                <Input
                  id="test-email-desktop"
                  type="email"
                  v-model="testEmailAddress"
                  :placeholder="t('smtp.emailTest.emailAddress.placeholder')"
                  :class="{ 'border-destructive': testEmailAddress && !isValidEmail(testEmailAddress) }"
                />
                <p v-if="testEmailAddress && !isValidEmail(testEmailAddress)" class="text-sm text-destructive">
                  {{ t('smtp.emailTest.emailAddress.invalid') }}
                </p>
                <p class="text-xs text-muted-foreground">
                  {{ t('smtp.emailTest.emailAddress.description') }}
                </p>
              </div>

              <!-- Test Button -->
              <Button
                type="button"
                @click="handleTestEmail"
                :disabled="!canTestConnection"
                :loading="isTestingConnection"
                variant="outline"
                size="sm"
                class="w-full sm:w-auto"
              >
                <TestTube class="h-4 w-4 mr-2" />
                {{ t('smtp.emailTest.button.test') }}
              </Button>

              <!-- Test Status -->
              <Alert v-if="lastTestResult" :variant="getAlertVariant(lastTestResult)">
                <component
                  :is="lastTestResult.success ? CheckCircle : XCircle"
                  class="h-4 w-4"
                />
                <AlertTitle>
                  {{ lastTestResult.success ? t('smtp.emailTest.status.success') : t('smtp.emailTest.status.failed') }}
                </AlertTitle>
                <AlertDescription>
                  {{ getStatusMessage(lastTestResult) }}
                </AlertDescription>
              </Alert>

              <!-- Test Requirements -->
              <div v-if="!canTestConnection" class="flex items-start space-x-2 p-3 bg-muted rounded-lg">
                <Info class="h-4 w-4 text-muted-foreground mt-0.5" />
                <div class="text-sm text-muted-foreground">
                  <p class="font-medium">{{ t('smtp.emailTest.requirements.title') }}</p>
                  <ul class="list-disc list-inside mt-1 space-y-1">
                    <li>{{ t('smtp.emailTest.requirements.enabled') }}</li>
                    <li>{{ t('smtp.emailTest.requirements.host') }}</li>
                    <li>{{ t('smtp.emailTest.requirements.port') }}</li>
                    <li>{{ t('smtp.emailTest.requirements.username') }}</li>
                    <li>{{ t('smtp.emailTest.requirements.password') }}</li>
                    <li>{{ t('smtp.emailTest.requirements.testEmail') }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <Separator />

            <!-- Save Button -->
            <div class="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
              <div class="flex items-center space-x-2">
                <Badge v-if="hasChanges" variant="outline">
                  {{ t('smtp.form.unsavedChanges') }}
                </Badge>
              </div>
              <Button
                type="submit"
                :disabled="!hasChanges"
                :loading="isSaving"
                class="min-w-[120px] w-full sm:w-auto"
              >
                {{ t('smtp.form.saveChanges') }}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
</template>
