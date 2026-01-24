<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

interface EnvironmentConfig {
  teamEnv: Record<string, string>
  templateArgs: string[]
}

const props = defineProps<{
  modelValue?: EnvironmentConfig
  repositoryName: string
  branch: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: EnvironmentConfig]
  'back': []
  'deploy': []
}>()

const { t } = useI18n()

const teamEnv = ref<Record<string, string>>({})
const templateArgs = ref<string[]>([])
const isDeploying = ref(false)

const repoPath = computed(() => {
  const url = props.repositoryName
  const match = url.match(/github\.com[/:]([\w-]+\/[\w-]+)/)
  return match?.[1]?.replace('.git', '') ?? props.repositoryName
})

function addEnv() {
  const newKey = `ENV_${Object.keys(teamEnv.value).length + 1}`
  teamEnv.value[newKey] = ''
}

function removeEnv(key: string) {
  delete teamEnv.value[key]
}

function updateEnvKey(oldKey: string, newKey: string) {
  if (oldKey === newKey) return
  const value = teamEnv.value[oldKey]
  delete teamEnv.value[oldKey]
  if (value !== undefined) {
    teamEnv.value[newKey] = value
  }
}

function addArg() {
  templateArgs.value.push('')
}

function removeArg(index: number) {
  templateArgs.value.splice(index, 1)
}

async function handleDeploy() {
  isDeploying.value = true

  emit('update:modelValue', {
    teamEnv: teamEnv.value,
    templateArgs: templateArgs.value.filter(arg => arg.trim() !== '')
  })

  try {
    emit('deploy')
  } finally {
    isDeploying.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-bold mb-2">{{ t('deployments.wizard.configureEnvironment.title') }}</h2>
    </div>

    <!-- Repository Info -->
    <div class="bg-muted p-4 rounded-lg">
      <div class="space-y-1">
        <div class="text-sm text-muted-foreground">{{ t('deployments.wizard.configureEnvironment.repositoryLabel') }}</div>
        <div class="font-semibold">{{ repositoryName }}</div>
      </div>
      <div class="space-y-1 mt-2">
        <div class="text-sm text-muted-foreground">{{ t('deployments.wizard.configureEnvironment.branchLabel') }}</div>
        <div class="font-mono text-sm">{{ branch }}</div>
      </div>
    </div>

    <!-- Team Environment Variables -->
    <div class="space-y-3">
      <div>
        <h3 class="font-semibold mb-1">{{ t('deployments.wizard.configureEnvironment.envVars.title') }}</h3>
        <p class="text-sm text-muted-foreground">
          {{ t('deployments.wizard.configureEnvironment.envVars.description') }}
        </p>
      </div>

      <div v-for="(value, key) in teamEnv" :key="key" class="flex gap-2">
        <Input
          :value="key"
          @input="updateEnvKey(key, ($event.target as HTMLInputElement).value)"
          :placeholder="t('deployments.wizard.configureEnvironment.envVars.keyPlaceholder')"
          class="flex-1 font-mono text-sm"
        />
        <Input
          v-model="teamEnv[key]"
          :placeholder="t('deployments.wizard.configureEnvironment.envVars.valuePlaceholder')"
          class="flex-1 font-mono text-sm"
        />
        <Button
          variant="ghost"
          @click="removeEnv(key)"
          class="text-destructive hover:text-destructive"
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
        <h3 class="font-semibold mb-1">{{ t('deployments.wizard.configureEnvironment.templateArgs.title') }}</h3>
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
          variant="ghost"
          @click="removeArg(index)"
          class="text-destructive hover:text-destructive"
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

    <!-- Command Preview -->
    <div class="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg font-mono text-sm">
      <div class="text-gray-400 mb-2">{{ t('deployments.wizard.configureEnvironment.commandPreview.comment') }}</div>
      <div class="text-green-400">npx -y github:{{ repoPath }}#{'{commit_sha}'}</div>
      <div v-if="templateArgs.length" class="mt-3">
        <div class="text-gray-400 mb-1">{{ t('deployments.wizard.configureEnvironment.commandPreview.withArgs') }}</div>
        <div v-for="arg in templateArgs.filter(a => a.trim())" :key="arg" class="ml-4 text-blue-400">
          {{ arg }}
        </div>
      </div>
    </div>

    <!-- Navigation Buttons -->
    <div class="flex justify-between pt-4">
      <Button variant="outline" @click="$emit('back')" :disabled="isDeploying">
        {{ t('deployments.wizard.buttons.back') }}
      </Button>
      <Button
        @click="handleDeploy"
        :disabled="isDeploying"
        class="bg-green-600 hover:bg-green-700 text-white"
      >
        <Spinner v-if="isDeploying" class="mr-2 h-4 w-4" />
        {{ isDeploying ? t('deployments.wizard.buttons.deploying') : t('deployments.wizard.buttons.deploy') }}
      </Button>
    </div>
  </div>
</template>
