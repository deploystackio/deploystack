<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Eye, EyeOff } from 'lucide-vue-next'
import { McpInstallationService } from '@/services/mcpInstallationService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Props {
  open: boolean
  teamId: string
  installationId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'config-added': []
}>()

const { t } = useI18n()

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const activeTab = ref<'env' | 'args'>('env')
const isSubmitting = ref(false)
const showPassword = ref(false)

// Form state
const itemName = ref('')
const itemType = ref<'string' | 'secret' | 'boolean'>('string')
const itemDescription = ref('')
const itemRequired = ref(false)
const itemValue = ref('')
const formErrors = ref<Record<string, string>>({})

// Reset value when type changes to avoid carrying invalid values across types
watch(itemType, () => {
  itemValue.value = ''
})

const resetForm = () => {
  itemName.value = ''
  itemType.value = 'string'
  itemDescription.value = ''
  itemRequired.value = false
  itemValue.value = ''
  showPassword.value = false
  formErrors.value = {}
}

const handleCancel = () => {
  resetForm()
  isOpen.value = false
}

const validate = (): boolean => {
  const errors: Record<string, string> = {}
  if (!itemName.value.trim()) {
    errors.name = t('mcpInstallations.configSchema.addModal.validation.nameRequired')
  }
  formErrors.value = errors
  return Object.keys(errors).length === 0
}

const handleSubmit = async () => {
  if (!validate()) return

  isSubmitting.value = true
  try {
    await McpInstallationService.updateConfigSchema(
      props.teamId,
      props.installationId,
      {
        action: 'add',
        config_type: activeTab.value,
        item: {
          name: itemName.value.trim(),
          type: itemType.value,
          ...(itemDescription.value.trim() && { description: itemDescription.value.trim() }),
          ...(itemRequired.value && { required: true }),
          ...(itemValue.value && { value: itemValue.value })
        }
      }
    )

    toast.success(t('mcpInstallations.configSchema.addModal.success.added'), {
      description: t('mcpInstallations.configSchema.addModal.success.addedDescription', { name: itemName.value })
    })

    resetForm()
    isOpen.value = false
    emit('config-added')
  } catch (error) {
    toast.error(t('mcpInstallations.configSchema.addModal.error.addFailed'), {
      description: error instanceof Error ? error.message : 'An error occurred'
    })
  } finally {
    isSubmitting.value = false
  }
}

const getInputType = () => {
  if (itemType.value === 'secret' && !showPassword.value) return 'password'
  return 'text'
}
</script>

<template>
  <AlertDialog :open="isOpen" @update:open="(value) => isOpen = value">
    <AlertDialogContent class="sm:max-w-[500px]">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t('mcpInstallations.configSchema.addModal.title') }}</AlertDialogTitle>
        <AlertDialogDescription>
          {{ t('mcpInstallations.configSchema.addModal.description') }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-2">
          <TabsTrigger value="env">{{ t('mcpInstallations.configSchema.addModal.tabs.env') }}</TabsTrigger>
          <TabsTrigger value="args">{{ t('mcpInstallations.configSchema.addModal.tabs.args') }}</TabsTrigger>
        </TabsList>

        <TabsContent value="env">
          <form @submit.prevent="handleSubmit" class="space-y-4 mt-4">
            <div class="space-y-2">
              <Label for="env-name">{{ t('mcpInstallations.configSchema.addModal.form.name') }}</Label>
              <Input
                id="env-name"
                v-model="itemName"
                :placeholder="t('mcpInstallations.configSchema.addModal.form.namePlaceholder')"
                :class="{ 'border-destructive': formErrors.name }"
              />
              <div v-if="formErrors.name" class="text-sm text-destructive">{{ formErrors.name }}</div>
            </div>

            <div class="space-y-2">
              <Label for="env-type">{{ t('mcpInstallations.configSchema.addModal.form.type') }}</Label>
              <Select v-model="itemType">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="secret">secret</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label for="env-description">{{ t('mcpInstallations.configSchema.addModal.form.description') }}</Label>
              <Input
                id="env-description"
                v-model="itemDescription"
                :placeholder="t('mcpInstallations.configSchema.addModal.form.descriptionPlaceholder')"
              />
            </div>

            <div class="flex items-center space-x-2">
              <Checkbox id="env-required" :checked="itemRequired" @update:checked="(val) => itemRequired = !!val" />
              <Label for="env-required" class="cursor-pointer">{{ t('mcpInstallations.configSchema.addModal.form.required') }}</Label>
            </div>

            <div class="space-y-2">
              <Label for="env-value">{{ t('mcpInstallations.configSchema.addModal.form.value') }}</Label>
              <!-- Boolean select -->
              <Select v-if="itemType === 'boolean'" v-model="itemValue">
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">false</SelectItem>
                  <SelectItem value="true">true</SelectItem>
                </SelectContent>
              </Select>
              <!-- Regular/secret input -->
              <div v-else class="relative">
                <Input
                  id="env-value"
                  :type="getInputType()"
                  v-model="itemValue"
                  :placeholder="t('mcpInstallations.configSchema.addModal.form.valuePlaceholder')"
                />
                <Button
                  v-if="itemType === 'secret'"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  @click="showPassword = !showPassword"
                >
                  <Eye v-if="!showPassword" class="h-4 w-4" />
                  <EyeOff v-else class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <AlertDialogFooter>
              <Button type="button" variant="outline" @click="handleCancel">
                {{ t('mcpInstallations.configSchema.addModal.buttons.cancel') }}
              </Button>
              <Button type="submit" :disabled="isSubmitting">
                <Spinner v-if="isSubmitting" class="mr-2" />
                {{ isSubmitting ? t('mcpInstallations.configSchema.addModal.buttons.adding') : t('mcpInstallations.configSchema.addModal.buttons.add') }}
              </Button>
            </AlertDialogFooter>
          </form>
        </TabsContent>

        <TabsContent value="args">
          <form @submit.prevent="handleSubmit" class="space-y-4 mt-4">
            <div class="space-y-2">
              <Label for="args-name">{{ t('mcpInstallations.configSchema.addModal.form.name') }}</Label>
              <Input
                id="args-name"
                v-model="itemName"
                :placeholder="t('mcpInstallations.configSchema.addModal.form.nameArgsPlaceholder')"
                :class="{ 'border-destructive': formErrors.name }"
              />
              <div v-if="formErrors.name" class="text-sm text-destructive">{{ formErrors.name }}</div>
            </div>

            <div class="space-y-2">
              <Label for="args-type">{{ t('mcpInstallations.configSchema.addModal.form.type') }}</Label>
              <Select v-model="itemType">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">string</SelectItem>
                  <SelectItem value="secret">secret</SelectItem>
                  <SelectItem value="boolean">boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-2">
              <Label for="args-description">{{ t('mcpInstallations.configSchema.addModal.form.description') }}</Label>
              <Input
                id="args-description"
                v-model="itemDescription"
                :placeholder="t('mcpInstallations.configSchema.addModal.form.descriptionPlaceholder')"
              />
            </div>

            <div class="space-y-2">
              <Label for="args-value">{{ t('mcpInstallations.configSchema.addModal.form.value') }}</Label>
              <!-- Boolean select -->
              <Select v-if="itemType === 'boolean'" v-model="itemValue">
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">false</SelectItem>
                  <SelectItem value="true">true</SelectItem>
                </SelectContent>
              </Select>
              <!-- Regular/secret input -->
              <div v-else class="relative">
                <Input
                  id="args-value"
                  :type="getInputType()"
                  v-model="itemValue"
                  :placeholder="t('mcpInstallations.configSchema.addModal.form.valuePlaceholder')"
                />
                <Button
                  v-if="itemType === 'secret'"
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  @click="showPassword = !showPassword"
                >
                  <Eye v-if="!showPassword" class="h-4 w-4" />
                  <EyeOff v-else class="h-4 w-4" />
                </Button>
              </div>
            </div>

            <AlertDialogFooter>
              <Button type="button" variant="outline" @click="handleCancel">
                {{ t('mcpInstallations.configSchema.addModal.buttons.cancel') }}
              </Button>
              <Button type="submit" :disabled="isSubmitting">
                <Spinner v-if="isSubmitting" class="mr-2" />
                {{ isSubmitting ? t('mcpInstallations.configSchema.addModal.buttons.adding') : t('mcpInstallations.configSchema.addModal.buttons.add') }}
              </Button>
            </AlertDialogFooter>
          </form>
        </TabsContent>
      </Tabs>
    </AlertDialogContent>
  </AlertDialog>
</template>
