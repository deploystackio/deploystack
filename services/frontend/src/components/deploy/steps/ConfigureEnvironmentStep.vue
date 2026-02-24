<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Eye, EyeOff } from 'lucide-vue-next'

type ConfigType = 'string' | 'secret' | 'boolean'

interface EnvironmentConfig {
  teamEnv: Array<{ name: string; value: string; type: ConfigType }>
  templateArgs: Array<{ value: string; type: ConfigType }>
}

interface EnvVar {
  id: number
  key: string
  value: string
  type: ConfigType
}

interface ArgItem {
  id: number
  value: string
  type: ConfigType
}

const props = defineProps<{
  modelValue?: EnvironmentConfig
  repositoryName: string
  branch: string
  error?: { error: string; step: string } | null
}>()

const hasError = computed(() => props.error !== null)

const emit = defineEmits<{
  'update:modelValue': [value: EnvironmentConfig]
}>()

const { t } = useI18n()

const envVars = ref<EnvVar[]>([])
let envIdCounter = 0

const argItems = ref<ArgItem[]>([])
let argIdCounter = 0

// Track which rows show passwords (keyed by item id)
const showEnvPasswords = ref(new Set<number>())
const showArgPasswords = ref(new Set<number>())

const teamEnv = computed(() => {
  return envVars.value
    .filter(env => env.key.trim())
    .map(env => ({ name: env.key, value: env.value, type: env.type }))
})

const cleanedTemplateArgs = computed(() => {
  return argItems.value
    .filter(arg => arg.value.trim().length > 0)
    .map(arg => ({ value: arg.value.trim(), type: arg.type }))
})

// Watch and emit changes
watch([teamEnv, cleanedTemplateArgs], () => {
  emit('update:modelValue', {
    teamEnv: teamEnv.value,
    templateArgs: cleanedTemplateArgs.value
  })
}, { deep: true })

function addEnv() {
  envVars.value.push({
    id: envIdCounter++,
    key: '',
    value: '',
    type: 'secret'
  })
}

function removeEnv(id: number) {
  const index = envVars.value.findIndex(env => env.id === id)
  if (index !== -1) {
    envVars.value.splice(index, 1)
    showEnvPasswords.value.delete(id)
  }
}

function addArg() {
  argItems.value.push({
    id: argIdCounter++,
    value: '',
    type: 'string'
  })
}

function removeArg(id: number) {
  const index = argItems.value.findIndex(arg => arg.id === id)
  if (index !== -1) {
    argItems.value.splice(index, 1)
    showArgPasswords.value.delete(id)
  }
}

function getEnvInputType(env: EnvVar): string {
  if (env.type === 'secret' && !showEnvPasswords.value.has(env.id)) return 'password'
  return 'text'
}

function getArgInputType(arg: ArgItem): string {
  if (arg.type === 'secret' && !showArgPasswords.value.has(arg.id)) return 'password'
  return 'text'
}

function toggleEnvPassword(id: number) {
  if (showEnvPasswords.value.has(id)) {
    showEnvPasswords.value.delete(id)
  } else {
    showEnvPasswords.value.add(id)
  }
}

function toggleArgPassword(id: number) {
  if (showArgPasswords.value.has(id)) {
    showArgPasswords.value.delete(id)
  } else {
    showArgPasswords.value.add(id)
  }
}

function onEnvTypeChange(env: EnvVar) {
  env.value = ''
  showEnvPasswords.value.delete(env.id)
}

function onArgTypeChange(arg: ArgItem) {
  arg.value = ''
  showArgPasswords.value.delete(arg.id)
}
</script>

<template>
  <div>
    <!-- Error State -->
    <div v-if="hasError" class="mb-6">
      <Alert variant="destructive">
        <AlertCircle class="h-4 w-4" />
        <AlertTitle>{{ t('deployments.wizard.deployment.error.title') }}</AlertTitle>
        <AlertDescription>
          {{ error!.error }}
        </AlertDescription>
      </Alert>
    </div>

    <div class="space-y-12">
    <!-- Team Environment Variables -->
    <div class="space-y-3">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <h3 class="font-semibold">{{ t('deployments.wizard.configureEnvironment.envVars.title') }}</h3>
          <Badge variant="secondary">Team-wide</Badge>
          <Badge variant="outline">Optional</Badge>
        </div>
        <p class="text-sm text-muted-foreground">
          {{ t('deployments.wizard.configureEnvironment.envVars.description') }}
        </p>
      </div>

      <div v-for="env in envVars" :key="env.id" class="flex gap-2">
        <Input
          v-model="env.key"
          :placeholder="t('deployments.wizard.configureEnvironment.envVars.keyPlaceholder')"
          class="flex-1 font-mono text-sm"
        />
        <!-- Type selector -->
        <Select
          :model-value="env.type"
          @update:model-value="(val: ConfigType) => { env.type = val; onEnvTypeChange(env) }"
        >
          <SelectTrigger class="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="string">string</SelectItem>
            <SelectItem value="secret">secret</SelectItem>
            <SelectItem value="boolean">boolean</SelectItem>
          </SelectContent>
        </Select>
        <!-- Boolean: true/false dropdown -->
        <Select v-if="env.type === 'boolean'" v-model="env.value" class="flex-1">
          <SelectTrigger class="font-mono text-sm">
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">false</SelectItem>
            <SelectItem value="true">true</SelectItem>
          </SelectContent>
        </Select>
        <!-- Secret/String: input with optional eye toggle -->
        <div v-else class="relative flex-1">
          <Input
            v-model="env.value"
            :type="getEnvInputType(env)"
            :placeholder="t('deployments.wizard.configureEnvironment.envVars.valuePlaceholder')"
            class="font-mono text-sm"
            :class="{ 'pr-10': env.type === 'secret' }"
          />
          <Button
            v-if="env.type === 'secret'"
            type="button"
            variant="ghost"
            size="sm"
            class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            @click="toggleEnvPassword(env.id)"
          >
            <Eye v-if="!showEnvPasswords.has(env.id)" class="h-4 w-4" />
            <EyeOff v-else class="h-4 w-4" />
          </Button>
        </div>
        <Button
          @click="removeEnv(env.id)"
        >
          {{ t('deployments.wizard.configureEnvironment.envVars.remove') }}
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        @click="addEnv"
        class="w-full"
      >
        {{ t('deployments.wizard.configureEnvironment.envVars.add') }}
      </Button>
    </div>

    <!-- Template Arguments -->
    <div class="space-y-3">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <h3 class="font-semibold">{{ t('deployments.wizard.configureEnvironment.templateArgs.title') }}</h3>
          <Badge variant="secondary">Team-wide</Badge>
          <Badge variant="outline">Optional</Badge>
        </div>
        <p class="text-sm text-muted-foreground">
          {{ t('deployments.wizard.configureEnvironment.templateArgs.description') }}
        </p>
      </div>

      <div v-for="arg in argItems" :key="arg.id" class="flex gap-2">
        <!-- Type selector -->
        <Select
          :model-value="arg.type"
          @update:model-value="(val: ConfigType) => { arg.type = val; onArgTypeChange(arg) }"
        >
          <SelectTrigger class="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="string">string</SelectItem>
            <SelectItem value="secret">secret</SelectItem>
            <SelectItem value="boolean">boolean</SelectItem>
          </SelectContent>
        </Select>
        <!-- Boolean: true/false dropdown -->
        <Select v-if="arg.type === 'boolean'" v-model="arg.value" class="flex-1">
          <SelectTrigger class="font-mono text-sm">
            <SelectValue placeholder="Select value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">false</SelectItem>
            <SelectItem value="true">true</SelectItem>
          </SelectContent>
        </Select>
        <!-- Secret/String: input with optional eye toggle -->
        <div v-else class="relative flex-1">
          <Input
            v-model="arg.value"
            :type="getArgInputType(arg)"
            :placeholder="t('deployments.wizard.configureEnvironment.templateArgs.placeholder')"
            class="font-mono text-sm"
            :class="{ 'pr-10': arg.type === 'secret' }"
          />
          <Button
            v-if="arg.type === 'secret'"
            type="button"
            variant="ghost"
            size="sm"
            class="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
            @click="toggleArgPassword(arg.id)"
          >
            <Eye v-if="!showArgPasswords.has(arg.id)" class="h-4 w-4" />
            <EyeOff v-else class="h-4 w-4" />
          </Button>
        </div>
        <Button
          @click="removeArg(arg.id)"
        >
          {{ t('deployments.wizard.configureEnvironment.templateArgs.remove') }}
        </Button>
      </div>

      <Button
        variant="outline"
        size="sm"
        @click="addArg"
        class="w-full"
      >
        {{ t('deployments.wizard.configureEnvironment.templateArgs.add') }}
      </Button>
    </div>
    </div>
  </div>
</template>
