<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ConfigItem } from './types'

interface CategoryOption {
  value: string
  label: { value: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any
  color: string
}

interface Props {
  open: boolean
  mode: 'add' | 'edit'
  formData: ConfigItem
  formErrors: Record<string, string>
  isFormValid: boolean
  availableCategoryOptions: CategoryOption[]
  typeOptions: Array<{ value: string; label: { value: string } }>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:formData': [value: Partial<ConfigItem>]
  submit: []
  cancel: []
}>()

const { t } = useI18n()

const modalTitle = computed(() => {
  const modalKey = props.mode === 'add' ? 'add' : 'edit'
  let typeKey = 'argument'
  if (props.formData.type === 'env') {
    typeKey = 'environment'
  } else if (props.formData.type === 'header') {
    typeKey = 'header'
  }
  return t(`mcpCatalog.form.configurationSchema.modal.${modalKey}.${typeKey}`)
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updateFormField = (field: keyof ConfigItem, value: any) => {
  emit('update:formData', { [field]: value })
}
</script>

<template>
  <AlertDialog :open="open" @update:open="(value) => emit('update:open', value)">
    <AlertDialogContent class="sm:max-w-[600px]">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ modalTitle }}</AlertDialogTitle>
        <AlertDialogDescription>
          Configure this item for your MCP server.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <form @submit.prevent="emit('submit')" class="space-y-4">
        <!-- Name Field -->
        <div class="space-y-2">
          <Label for="item-name">
            {{
              formData.type === 'arg'
                ? $t('mcpCatalog.form.configurationSchema.modal.fields.argument.label')
                : formData.type === 'env'
                  ? $t('mcpCatalog.form.configurationSchema.modal.fields.name.label')
                  : $t('mcpCatalog.form.configurationSchema.modal.fields.headerName.label')
            }}
          </Label>
          <Input
            id="item-name"
            :model-value="formData.name"
            @update:model-value="(value) => updateFormField('name', value)"
            :placeholder="
              formData.type === 'arg'
                ? $t('mcpCatalog.form.configurationSchema.modal.fields.argument.placeholder')
                : formData.type === 'env'
                  ? $t('mcpCatalog.form.configurationSchema.modal.fields.name.placeholders.environment')
                  : $t('mcpCatalog.form.configurationSchema.modal.fields.name.placeholders.header')
            "
            :class="{ 'border-destructive': formErrors.name }"
            class="font-mono"
            required
          />
          <div v-if="formErrors.name" class="text-sm text-destructive">
            {{ formErrors.name }}
          </div>
        </div>

        <!-- Category -->
        <div class="space-y-2">
          <Label for="item-category">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.category.label') }}</Label>
          <Select :model-value="formData.category" @update:model-value="(value) => updateFormField('category', value)">
            <SelectTrigger>
              <SelectValue :placeholder="$t('mcpCatalog.form.configurationSchema.modal.fields.category.placeholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in availableCategoryOptions" :key="option.value" :value="option.value">
                <div class="flex items-center gap-2">
                  <component :is="option.icon" class="w-4 h-4" />
                  {{ option.label.value }}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Data Type -->
        <div v-if="formData.category !== 'template'" class="space-y-2">
          <Label for="item-type">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.dataType.label') }}</Label>
          <Select :model-value="formData.dataType" @update:model-value="(value) => updateFormField('dataType', value)">
            <SelectTrigger>
              <SelectValue :placeholder="$t('mcpCatalog.form.configurationSchema.modal.fields.dataType.placeholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="option in typeOptions" :key="option.value" :value="option.value">
                {{ option.label.value }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Description -->
        <div class="space-y-2">
          <Label for="item-description">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.description.label') }}</Label>
          <Textarea
            id="item-description"
            :model-value="formData.description"
            @update:model-value="(value) => updateFormField('description', value)"
            :placeholder="$t('mcpCatalog.form.configurationSchema.modal.fields.description.placeholder')"
            rows="2"
          />
        </div>

        <!-- Options -->
        <div class="space-y-3">
          <div class="flex items-center space-x-2" v-if="formData.category !== 'template'">
            <Switch
              id="item-required"
              :model-value="formData.required"
              @update:model-value="(value: boolean) => updateFormField('required', value)"
            />
            <Label for="item-required">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.options.required') }}</Label>
          </div>

          <div class="flex items-center space-x-2">
            <Switch
              id="item-locked"
              :model-value="formData.locked"
              @update:model-value="(value: boolean) => updateFormField('locked', value)"
            />
            <Label for="item-locked">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.options.locked') }}</Label>
          </div>

          <div class="flex items-center space-x-2" v-if="formData.category === 'team'">
            <Switch
              id="item-default-team-locked"
              :model-value="formData.default_team_locked"
              @update:model-value="(value: boolean) => updateFormField('default_team_locked', value)"
            />
            <Label for="item-default-team-locked">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.options.defaultTeamLocked') }}</Label>
          </div>

          <div class="flex items-center space-x-2" v-if="(formData.type === 'env' || formData.type === 'header') && formData.category === 'team'">
            <Switch
              id="item-visible-to-users"
              :model-value="formData.visible_to_users"
              @update:model-value="(value: boolean) => updateFormField('visible_to_users', value)"
            />
            <Label for="item-visible-to-users">{{ $t('mcpCatalog.form.configurationSchema.modal.fields.options.visibleToUsers') }}</Label>
          </div>
        </div>

        <AlertDialogFooter>
          <Button type="button" variant="outline" @click="emit('cancel')">
            {{ $t('mcpCatalog.form.configurationSchema.modal.actions.cancel') }}
          </Button>
          <Button type="submit" :disabled="!isFormValid">
            {{ $t(`mcpCatalog.form.configurationSchema.modal.actions.${mode === 'add' ? 'add' : 'update'}`) }}
          </Button>
        </AlertDialogFooter>
      </form>
    </AlertDialogContent>
  </AlertDialog>
</template>
