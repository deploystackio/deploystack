<script setup lang="ts">
import { ref, computed } from 'vue'
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
  hasChanges,
  saveForm,
  updateField,
  getFieldError
} = useSettingsForm(props.settings)

// Use the connection test composable
const {
  isTestingConnection,
  testSmtpEmailConnection
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

  if (result.success) {
    toast.success(t('smtp.emailTest.status.success'), {
      description: `Test email sent to ${testEmailAddress.value}`
    })
  } else {
    toast.error(t('smtp.emailTest.status.failed'), {
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
    <!-- SMTP Configuration Card -->
    <DsCard :title="props.group.name">
      <p v-if="props.group.description" class="text-sm text-muted-foreground mb-6">
        {{ props.group.description }}
      </p>

      <div class="space-y-6">
        <!-- Email Functionality Checkbox -->
        <div class="flex items-start gap-3">
          <Checkbox
            id="smtp-enabled"
            :checked="Boolean(formValues['smtp.enabled'])"
            @update:checked="(value: boolean) => updateField('smtp.enabled', value)"
          />
          <div class="grid gap-1">
            <label
              for="smtp-enabled"
              class="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {{ getSetting('smtp.enabled')?.name || t('smtp.fields.enabled.label') }}
            </label>
            <p class="text-muted-foreground text-sm">
              {{ getSetting('smtp.enabled')?.description || t('smtp.fields.enabled.description') }}
            </p>
          </div>
        </div>

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

        <!-- SMTP Secure Checkbox -->
        <div class="flex items-start gap-3">
          <Checkbox
            id="smtp-secure"
            :checked="Boolean(formValues['smtp.secure'])"
            @update:checked="(value: boolean) => updateField('smtp.secure', value)"
          />
          <div class="grid gap-1">
            <label
              for="smtp-secure"
              class="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {{ getSetting('smtp.secure')?.name || t('smtp.fields.secure.label') }}
            </label>
            <p class="text-muted-foreground text-sm">
              {{ getSetting('smtp.secure')?.description || t('smtp.fields.secure.description') }}
            </p>
          </div>
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
      </div>

      <template #footer-status>
        <span v-if="hasChanges" class="text-amber-600">
          {{ t('smtp.form.unsavedChanges') }}
        </span>
        <span v-else>
          <a
            href="https://docs.deploystack.io/self-hosted/setup#email-configuration-smtp"
            target="_blank"
            class="link"
          >
            Learn more about email configuration
          </a>
        </span>
      </template>

      <template #footer-actions>
        <Button
          :disabled="!hasChanges || isSaving"
          @click="handleSave"
        >
          <Spinner v-if="isSaving" class="mr-2" />
          {{ t('smtp.form.saveChanges') }}
        </Button>
      </template>
    </DsCard>

    <!-- Email Test Card -->
    <DsCard :title="t('smtp.emailTest.title')">
      <p class="text-sm text-muted-foreground mb-6">
        {{ t('smtp.emailTest.description') }} Testing becomes available when email functionality is enabled and all required SMTP fields are configured.
      </p>

      <div class="space-y-4">
        <!-- Test Email Address Input -->
        <div class="space-y-2">
          <Label for="test-email">
            {{ t('smtp.emailTest.emailAddress.label') }}
          </Label>
          <Input
            id="test-email"
            type="email"
            v-model="testEmailAddress"
            placeholder="mail@deploystack.io"
            :class="{ 'border-destructive': testEmailAddress && !isValidEmail(testEmailAddress) }"
          />
          <p v-if="testEmailAddress && !isValidEmail(testEmailAddress)" class="text-sm text-destructive">
            {{ t('smtp.emailTest.emailAddress.invalid') }}
          </p>
        </div>
      </div>

      <template #footer-actions>
        <Button
          @click="handleTestEmail"
          :disabled="!canTestConnection || isTestingConnection"
          variant="outline"
        >
          <Spinner v-if="isTestingConnection" class="mr-2" />
          {{ t('smtp.emailTest.button.test') }}
        </Button>
      </template>
    </DsCard>
  </div>
</template>
