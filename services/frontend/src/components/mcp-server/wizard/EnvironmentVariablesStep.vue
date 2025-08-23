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

interface ServerData {
  id: string
  name: string
  description?: string
  author_name?: string
  category_id?: string
  team_env_schema?: string | EnvironmentVariable[]
  user_env_schema?: string | EnvironmentVariable[]
  [key: string]: unknown
}

const modelValue = defineModel<{
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

const teamEnvSchema = computed(() => parseEnvSchema(props.serverData?.team_env_schema))
const userEnvSchema = computed(() => parseEnvSchema(props.serverData?.user_env_schema))

const hasTeamEnvVars = computed(() => teamEnvSchema.value.length > 0)
const hasUserEnvVars = computed(() => userEnvSchema.value.length > 0)
const hasAnyEnvVars = computed(() => hasTeamEnvVars.value || hasUserEnvVars.value)

const validateTeamEnvVars = () => {
  const missingFields: string[] = []
  let isValid = true

  teamEnvSchema.value.forEach((envVar) => {
    if (envVar.required && !modelValue.value.team_env[envVar.name]?.trim()) {
      missingFields.push(envVar.name)
      isValid = false
    }
  })

  emit('validation-change', isValid, missingFields)
  return isValid
}

watch(() => modelValue.value.team_env, () => {
  validateTeamEnvVars()
}, { deep: true })

watch(() => props.serverData, (newData) => {
  if (newData) {
    const newTeamEnv: Record<string, string> = {}
    const newUserEnv: Record<string, string> = {}

    const teamSchema = parseEnvSchema(newData.team_env_schema)
    const userSchema = parseEnvSchema(newData.user_env_schema)

    teamSchema.forEach((env) => {
      newTeamEnv[env.name] = modelValue.value.team_env?.[env.name] || ''
    })

    userSchema.forEach((env) => {
      newUserEnv[env.name] = ''
    })

    modelValue.value = {
      team_env: newTeamEnv,
      user_env: newUserEnv
    }

    validateTeamEnvVars()
  }
}, { immediate: true })

const getInputType = (envVar: EnvironmentVariable) => {
  return envVar.type === 'password' ? 'password' : 'text'
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

    <div v-if="hasAnyEnvVars" class="space-y-8">
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

      <div v-if="hasUserEnvVars" class="bg-gray-50 p-4">
        <div class="mb-4">
          <h3 class="text-lg font-medium text-gray-900">
            {{ t('mcpInstallations.teamConfiguration.sections.userEnv.title') }}
          </h3>
          <span class="text-sm text-gray-500">
            {{ userEnvSchema.length }} {{ userEnvSchema.length === 1 ? t('mcpInstallations.teamConfiguration.sections.teamEnv.counter.single') : t('mcpInstallations.teamConfiguration.sections.teamEnv.counter.plural') }}
          </span>
        </div>

        <div class="mb-4 p-3 bg-gray-100">
          <div class="text-sm text-gray-700">
            <strong>{{ t('mcpInstallations.teamConfiguration.sections.userEnv.infoNote') }}</strong> {{ t('mcpInstallations.teamConfiguration.sections.userEnv.individualConfig') }}
            {{ t('mcpInstallations.teamConfiguration.sections.userEnv.perMemberConfig') }}
          </div>
        </div>

        <div class="space-y-4">
          <div v-for="envVar in userEnvSchema" :key="envVar.name" class="bg-white p-4">
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
