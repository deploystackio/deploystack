<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import McpServerCard from '@/components/mcp-server/McpServerCard.vue'

interface EnvironmentVariable {
  name: string
  type?: string
  description?: string
  placeholder?: string
  required?: boolean
  visible_to_users?: boolean
}

interface ArgumentSchema {
  name: string
  type?: string
  description?: string
  placeholder?: string
  required?: boolean
  locked?: boolean
  default_team_locked?: boolean
}

interface ServerData {
  id: string
  name: string
  description?: string
  author_name?: string
  category_id?: string
  team_args_schema?: string | ArgumentSchema[]
  team_env_schema?: string | EnvironmentVariable[]
  user_args_schema?: string | ArgumentSchema[]
  user_env_schema?: string | EnvironmentVariable[]
  [key: string]: unknown
}

const modelValue = defineModel<{
  team_args: string[]
  team_env: Record<string, string>
  user_env: Record<string, string>
}>({ required: true })

interface Props {
  serverData?: ServerData
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'validation-change': [isValid: boolean, missingFields: string[]]
}>()

const { t } = useI18n()

const parseEnvSchema = (schema: string | EnvironmentVariable[] | undefined): EnvironmentVariable[] => {
  if (!schema) return []

  try {
    const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Error parsing environment schema:', error)
    return []
  }
}

const parseArgsSchema = (schema: string | ArgumentSchema[] | undefined): ArgumentSchema[] => {
  if (!schema) return []

  try {
    const parsed = typeof schema === 'string' ? JSON.parse(schema) : schema
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('Error parsing arguments schema:', error)
    return []
  }
}

const teamArgsSchema = computed(() => parseArgsSchema(props.serverData?.team_args_schema))
const teamEnvSchema = computed(() => parseEnvSchema(props.serverData?.team_env_schema))
const userArgsSchema = computed(() => parseArgsSchema(props.serverData?.user_args_schema))
const userEnvSchema = computed(() => parseEnvSchema(props.serverData?.user_env_schema))

const hasTeamArgs = computed(() => teamArgsSchema.value.length > 0)
const hasTeamEnvVars = computed(() => teamEnvSchema.value.length > 0)
const hasUserArgs = computed(() => userArgsSchema.value.length > 0)
const hasUserEnvVars = computed(() => userEnvSchema.value.length > 0)
const hasUserConfiguration = computed(() => hasUserArgs.value || hasUserEnvVars.value)
const hasAnyConfiguration = computed(() => hasTeamArgs.value || hasTeamEnvVars.value || hasUserConfiguration.value)

const validateConfiguration = () => {
  const missingFields: string[] = []
  let isValid = true

  // Validate team arguments
  teamArgsSchema.value.forEach((arg, index) => {
    if (arg.required && !modelValue.value.team_args[index]?.trim()) {
      missingFields.push(arg.name)
      isValid = false
    }
  })

  // Validate team environment variables
  teamEnvSchema.value.forEach((envVar) => {
    if (envVar.required && !modelValue.value.team_env[envVar.name]?.trim()) {
      missingFields.push(envVar.name)
      isValid = false
    }
  })

  emit('validation-change', isValid, missingFields)
  return isValid
}

watch(() => modelValue.value.team_args, () => {
  validateConfiguration()
}, { deep: true })

watch(() => modelValue.value.team_env, () => {
  validateConfiguration()
}, { deep: true })

watch(() => props.serverData, (newData) => {
  if (newData) {
    const newTeamArgs: string[] = []
    const newTeamEnv: Record<string, string> = {}
    const newUserEnv: Record<string, string> = {}

    const argsSchema = parseArgsSchema(newData.team_args_schema)
    const teamSchema = parseEnvSchema(newData.team_env_schema)
    const userSchema = parseEnvSchema(newData.user_env_schema)

    // Initialize team arguments array
    argsSchema.forEach((arg, index) => {
      newTeamArgs[index] = modelValue.value.team_args?.[index] || ''
    })

    teamSchema.forEach((env) => {
      newTeamEnv[env.name] = modelValue.value.team_env?.[env.name] || ''
    })

    userSchema.forEach((env) => {
      newUserEnv[env.name] = ''
    })

    modelValue.value = {
      team_args: newTeamArgs,
      team_env: newTeamEnv,
      user_env: newUserEnv
    }

    validateConfiguration()
  }
}, { immediate: true })

const getInputType = (envVar: EnvironmentVariable) => {
  return (envVar.type === 'password' || envVar.type === 'secret') ? 'password' : 'text'
}

const getArgInputType = (arg: ArgumentSchema) => {
  return (arg.type === 'password' || arg.type === 'secret') ? 'password' : 'text'
}

const isTextarea = (envVar: EnvironmentVariable) => {
  return envVar.type === 'textarea' ||
         (envVar.description?.toLowerCase().includes('json')) ||
         (envVar.placeholder && envVar.placeholder.length > 100)
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        {{ t('mcpInstallations.wizard.environment.title') }}
      </h2>
      <p class="text-gray-600">
        {{ t('mcpInstallations.wizard.environment.description') }}
      </p>
    </div>

    <McpServerCard
      v-if="serverData"
      :server="serverData"
      :show-install-button="false"
      :show-details-button="false"
    />

    <div v-if="hasAnyConfiguration" class="space-y-8">
      <!-- Team Arguments Section -->
      <div v-if="hasTeamArgs" class="bg-blue-50 p-4">
        <div class="mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            {{ t('mcpInstallations.teamConfiguration.sections.teamArgs.title') }}
          </h3>
          <span class="text-sm text-gray-500">
            {{ teamArgsSchema.length }} {{ teamArgsSchema.length === 1 ? t('mcpInstallations.teamConfiguration.sections.teamArgs.counter.single') : t('mcpInstallations.teamConfiguration.sections.teamArgs.counter.plural') }}
          </span>
        </div>
        <p class="text-sm text-gray-600 mb-6">
          {{ t('mcpInstallations.teamConfiguration.sections.teamArgs.description') }}
        </p>

        <div class="space-y-4">
          <div v-for="(arg, index) in teamArgsSchema" :key="`arg_${index}`" class="space-y-2">
            <div class="flex items-center gap-2">
              <Label :for="`team_arg_${index}`" class="flex items-center gap-2">
                {{ arg.name }}
                <span v-if="arg.required" class="text-xs text-gray-500">
                  {{ t('mcpInstallations.teamConfiguration.userEnvDetails.required') }}
                </span>
                <span v-else class="text-xs text-gray-500">
                  {{ t('mcpInstallations.teamConfiguration.userEnvDetails.optional') }}
                </span>
              </Label>
            </div>

            <div v-if="arg.description" class="text-sm text-gray-600">
              {{ arg.description }}
            </div>

            <div class="relative">
              <Input
                :id="`team_arg_${index}`"
                :type="getArgInputType(arg)"
                v-model="modelValue.team_args[index]"
                :placeholder="arg.placeholder || t('mcpInstallations.teamConfiguration.editModal.form.placeholders.enterValue')"
                :required="arg.required"
              />
            </div>

            <div v-if="arg.type" class="text-xs text-gray-500">
              {{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ arg.type }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- Team Environment Variables Section -->
      <div v-if="hasTeamEnvVars" class="bg-gray-50 p-4">
        <div class="mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            {{ t('mcpInstallations.teamConfiguration.sections.teamEnv.title') }}
          </h3>
          <span class="text-sm text-gray-500">
            {{ teamEnvSchema.length }} {{ teamEnvSchema.length === 1 ? t('mcpInstallations.teamConfiguration.sections.teamEnv.counter.single') : t('mcpInstallations.teamConfiguration.sections.teamEnv.counter.plural') }}
          </span>
        </div>
        <p class="text-sm text-gray-600 mb-6">
          {{ t('mcpInstallations.teamConfiguration.sections.teamEnv.description') }}
        </p>

        <div class="space-y-4">
          <div v-for="envVar in teamEnvSchema" :key="envVar.name" class="space-y-2">
            <div class="flex items-center gap-2">
              <Label :for="`team_${envVar.name}`" class="flex items-center gap-2">
                {{ envVar.name }}
                <span v-if="envVar.required" class="text-xs text-gray-500">
                  {{ t('mcpInstallations.teamConfiguration.userEnvDetails.required') }}
                </span>
                <span v-else class="text-xs text-gray-500">
                  {{ t('mcpInstallations.teamConfiguration.userEnvDetails.optional') }}
                </span>
                <span v-if="envVar.visible_to_users === false" class="text-xs text-gray-500">
                  {{ t('mcpInstallations.teamConfiguration.table.values.hiddenFromUsers') }}
                </span>
              </Label>
            </div>

            <div v-if="envVar.description" class="text-sm text-gray-600">
              {{ envVar.description }}
            </div>

            <div class="relative">
              <Textarea
                v-if="isTextarea(envVar)"
                :id="`team_${envVar.name}`"
                v-model="modelValue.team_env[envVar.name]"
                :placeholder="envVar.placeholder || t('mcpInstallations.teamConfiguration.editModal.form.placeholders.enterValue')"
                class="min-h-[100px]"
                :required="envVar.required"
              />

              <Input
                v-else
                :id="`team_${envVar.name}`"
                :type="getInputType(envVar)"
                v-model="modelValue.team_env[envVar.name]"
                :placeholder="envVar.placeholder || t('mcpInstallations.teamConfiguration.editModal.form.placeholders.enterValue')"
                :required="envVar.required"
              />
            </div>

            <div v-if="envVar.type" class="text-xs text-gray-500">
              {{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ envVar.type }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- User Configuration Section -->
      <div v-if="hasUserConfiguration" class="bg-gray-50 p-4">
        <div class="mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            {{ t('mcpInstallations.teamConfiguration.sections.userConfig.title') }}
          </h3>
          <span class="text-sm text-gray-500">
            {{ (userArgsSchema.length + userEnvSchema.length) }} {{ (userArgsSchema.length + userEnvSchema.length) === 1 ? t('mcpInstallations.teamConfiguration.sections.userConfig.counter.single') : t('mcpInstallations.teamConfiguration.sections.userConfig.counter.plural') }}
          </span>
        </div>

        <div class="mb-4 p-3 bg-gray-100">
          <div class="text-sm text-gray-700">
            <strong>{{ t('mcpInstallations.teamConfiguration.sections.userEnv.infoNote') }}</strong> {{ t('mcpInstallations.teamConfiguration.sections.userEnv.individualConfig') }}
            {{ t('mcpInstallations.teamConfiguration.sections.userEnv.perMemberConfig') }}
          </div>
        </div>

        <div class="space-y-4">
          <!-- User Arguments -->
          <div v-if="hasUserArgs" class="space-y-3">
            <h4 class="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {{ t('mcpInstallations.teamConfiguration.sections.userArgs.title') }}
            </h4>
            <div v-for="(arg, index) in userArgsSchema" :key="`user_arg_${index}`" class="bg-white p-4 rounded-lg border">
              <div class="flex items-center gap-2 mb-2">
                <span class="font-medium text-gray-900 font-mono">{{ arg.name }}</span>
                <span v-if="arg.required" class="text-xs text-gray-500">
                  {{ t('mcpInstallations.teamConfiguration.userEnvDetails.required') }}
                </span>
                <span v-else class="text-xs text-gray-500">
                  {{ t('mcpInstallations.teamConfiguration.userEnvDetails.optional') }}
                </span>
              </div>

              <div v-if="arg.description" class="text-sm text-gray-600 mb-2">
                {{ arg.description }}
              </div>

              <div class="flex items-center gap-4 text-xs text-gray-500">
                <span>{{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ arg.type || 'string' }}</code></span>
                <span v-if="arg.placeholder">{{ t('mcpInstallations.teamConfiguration.userEnvDetails.placeholderLabel') }} "{{ arg.placeholder }}"</span>
              </div>
            </div>
          </div>

          <!-- User Environment Variables -->
          <div v-if="hasUserEnvVars" class="space-y-3">
            <h4 class="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-2">
              {{ t('mcpInstallations.teamConfiguration.sections.userEnv.title') }}
            </h4>
            <div v-for="envVar in userEnvSchema" :key="envVar.name" class="bg-white p-4 rounded-lg border">
              <div class="flex items-center gap-2 mb-2">
                <span class="font-medium text-gray-900 font-mono">{{ envVar.name }}</span>
                <span v-if="envVar.required" class="text-xs text-gray-500">
                  {{ t('mcpInstallations.teamConfiguration.userEnvDetails.required') }}
                </span>
                <span v-else class="text-xs text-gray-500">
                  {{ t('mcpInstallations.teamConfiguration.userEnvDetails.optional') }}
                </span>
              </div>

              <div v-if="envVar.description" class="text-sm text-gray-600 mb-2">
                {{ envVar.description }}
              </div>

              <div class="flex items-center gap-4 text-xs text-gray-500">
                <span>{{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ envVar.type || 'string' }}</code></span>
                <span v-if="envVar.placeholder">{{ t('mcpInstallations.teamConfiguration.userEnvDetails.placeholderLabel') }} "{{ envVar.placeholder }}"</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="bg-gray-50 p-8 text-center">
      <h3 class="text-lg font-medium text-gray-900 mb-2">
        {{ t('mcpInstallations.wizard.environment.noVariables') }}
      </h3>
      <p class="text-gray-600">
        {{ t('mcpInstallations.wizard.environment.noVariablesDescription') }}
      </p>
    </div>
  </div>
</template>
