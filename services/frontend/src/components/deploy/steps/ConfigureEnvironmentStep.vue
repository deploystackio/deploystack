<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-vue-next'

interface EnvironmentConfig {
  teamEnv: Record<string, string>
  templateArgs: string[]
}

interface EnvVar {
  id: number
  key: string
  value: string
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

const teamEnv = computed(() => {
  const result: Record<string, string> = {}
  envVars.value.forEach(env => {
    if (env.key.trim()) {
      result[env.key] = env.value
    }
  })
  return result
})

const templateArgs = ref<string[]>([])

const cleanedTemplateArgs = computed(() => {
  return templateArgs.value
    .map(arg => arg.trim())
    .filter(arg => arg.length > 0)
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
    value: ''
  })
}

function removeEnv(id: number) {
  const index = envVars.value.findIndex(env => env.id === id)
  if (index !== -1) {
    envVars.value.splice(index, 1)
  }
}

function addArg() {
  templateArgs.value.push('')
}

function removeArg(index: number) {
  templateArgs.value.splice(index, 1)
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
        <Input
          v-model="env.value"
          :placeholder="t('deployments.wizard.configureEnvironment.envVars.valuePlaceholder')"
          class="flex-1 font-mono text-sm"
        />
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

      <div v-for="(arg, index) in templateArgs" :key="index" class="flex gap-2">
        <Input
          v-model="templateArgs[index]"
          :placeholder="t('deployments.wizard.configureEnvironment.templateArgs.placeholder')"
          class="flex-1 font-mono text-sm"
        />
        <Button
          @click="removeArg(index)"
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
