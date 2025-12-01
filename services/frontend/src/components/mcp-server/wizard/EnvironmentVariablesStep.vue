<script setup lang="ts">
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Item } from '@/components/ui/item'

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

interface HeaderSchema {
  name: string
  type?: string
  description?: string
  placeholder?: string
  required?: boolean
  visible_to_users?: boolean
}

interface QueryParamSchema {
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
  team_args_schema?: string | ArgumentSchema[]
  team_env_schema?: string | EnvironmentVariable[]
  team_headers_schema?: string | HeaderSchema[]
  team_url_query_params_schema?: string | QueryParamSchema[]
  user_args_schema?: string | ArgumentSchema[]
  user_env_schema?: string | EnvironmentVariable[]
  user_headers_schema?: string | HeaderSchema[]
  user_url_query_params_schema?: string | QueryParamSchema[]
  [key: string]: unknown
}

const modelValue = defineModel<{
  team_args: string[]
  team_env: Record<string, string>
  team_headers: Record<string, string>
  team_url_query_params: Record<string, string>
  user_args: Record<string, string>
  user_env: Record<string, string>
  user_headers: Record<string, string>
  user_url_query_params: Record<string, string>
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
const teamHeadersSchema = computed(() => parseEnvSchema(props.serverData?.team_headers_schema))
const teamQueryParamsSchema = computed(() => parseEnvSchema(props.serverData?.team_url_query_params_schema))
const userArgsSchema = computed(() => parseArgsSchema(props.serverData?.user_args_schema))
const userEnvSchema = computed(() => parseEnvSchema(props.serverData?.user_env_schema))
const userHeadersSchema = computed(() => parseEnvSchema(props.serverData?.user_headers_schema))
const userQueryParamsSchema = computed(() => parseEnvSchema(props.serverData?.user_url_query_params_schema))

const hasTeamArgs = computed(() => teamArgsSchema.value.length > 0)
const hasTeamEnvVars = computed(() => teamEnvSchema.value.length > 0)
const hasTeamHeaders = computed(() => teamHeadersSchema.value.length > 0)
const hasTeamQueryParams = computed(() => teamQueryParamsSchema.value.length > 0)
const hasUserArgs = computed(() => userArgsSchema.value.length > 0)
const hasUserEnvVars = computed(() => userEnvSchema.value.length > 0)
const hasUserHeaders = computed(() => userHeadersSchema.value.length > 0)
const hasUserQueryParams = computed(() => userQueryParamsSchema.value.length > 0)
const hasUserConfiguration = computed(() => hasUserArgs.value || hasUserEnvVars.value || hasUserHeaders.value || hasUserQueryParams.value)
const hasAnyConfiguration = computed(() => hasTeamArgs.value || hasTeamEnvVars.value || hasTeamHeaders.value || hasTeamQueryParams.value || hasUserConfiguration.value)

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

  // Validate team headers
  teamHeadersSchema.value.forEach((header) => {
    if (header.required && !modelValue.value.team_headers[header.name]?.trim()) {
      missingFields.push(header.name)
      isValid = false
    }
  })

  // Validate team query params
  teamQueryParamsSchema.value.forEach((param) => {
    if (param.required && !modelValue.value.team_url_query_params[param.name]?.trim()) {
      missingFields.push(param.name)
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

watch(() => modelValue.value.team_headers, () => {
  validateConfiguration()
}, { deep: true })

watch(() => modelValue.value.team_url_query_params, () => {
  validateConfiguration()
}, { deep: true })

watch(() => props.serverData, (newData) => {
  if (newData) {
    const newTeamArgs: string[] = []
    const newTeamEnv: Record<string, string> = {}
    const newTeamHeaders: Record<string, string> = {}
    const newTeamQueryParams: Record<string, string> = {}
    const newUserArgs: Record<string, string> = {}
    const newUserEnv: Record<string, string> = {}
    const newUserHeaders: Record<string, string> = {}
    const newUserQueryParams: Record<string, string> = {}

    const argsSchema = parseArgsSchema(newData.team_args_schema)
    const teamSchema = parseEnvSchema(newData.team_env_schema)
    const teamHeadersSchema = parseEnvSchema(newData.team_headers_schema)
    const teamQueryParamsSchemaData = parseEnvSchema(newData.team_url_query_params_schema)
    const userArgsSchemaData = parseArgsSchema(newData.user_args_schema)
    const userSchema = parseEnvSchema(newData.user_env_schema)
    const userHeadersSchemaData = parseEnvSchema(newData.user_headers_schema)
    const userQueryParamsSchemaData = parseEnvSchema(newData.user_url_query_params_schema)

    // Initialize team arguments array
    argsSchema.forEach((arg, index) => {
      newTeamArgs[index] = modelValue.value.team_args?.[index] || ''
    })

    teamSchema.forEach((env) => {
      const defaultValue = env.type === 'boolean' ? 'false' : ''
      newTeamEnv[env.name] = modelValue.value.team_env?.[env.name] || defaultValue
    })

    teamHeadersSchema.forEach((header) => {
      const defaultValue = header.type === 'boolean' ? 'false' : ''
      newTeamHeaders[header.name] = modelValue.value.team_headers?.[header.name] || defaultValue
    })

    teamQueryParamsSchemaData.forEach((param) => {
      const defaultValue = param.type === 'boolean' ? 'false' : ''
      newTeamQueryParams[param.name] = modelValue.value.team_url_query_params?.[param.name] || defaultValue
    })

    // Initialize user arguments
    userArgsSchemaData.forEach((arg) => {
      const defaultValue = arg.type === 'boolean' ? 'false' : ''
      newUserArgs[arg.name] = modelValue.value.user_args?.[arg.name] || defaultValue
    })

    userSchema.forEach((env) => {
      const defaultValue = env.type === 'boolean' ? 'false' : ''
      newUserEnv[env.name] = modelValue.value.user_env?.[env.name] || defaultValue
    })

    // Initialize user headers
    userHeadersSchemaData.forEach((header) => {
      const defaultValue = header.type === 'boolean' ? 'false' : ''
      newUserHeaders[header.name] = modelValue.value.user_headers?.[header.name] || defaultValue
    })

    userQueryParamsSchemaData.forEach((param) => {
      const defaultValue = param.type === 'boolean' ? 'false' : ''
      newUserQueryParams[param.name] = modelValue.value.user_url_query_params?.[param.name] || defaultValue
    })

    modelValue.value = {
      team_args: newTeamArgs,
      team_env: newTeamEnv,
      team_headers: newTeamHeaders,
      team_url_query_params: newTeamQueryParams,
      user_args: newUserArgs,
      user_env: newUserEnv,
      user_headers: newUserHeaders,
      user_url_query_params: newUserQueryParams
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

const isBoolean = (item: EnvironmentVariable | HeaderSchema | QueryParamSchema | ArgumentSchema) => {
  return item.type === 'boolean'
}

// Update boolean values with proper reactivity
const updateBooleanValue = (type: 'team_env' | 'team_headers' | 'team_url_query_params' | 'user_args' | 'user_env' | 'user_headers' | 'user_url_query_params', key: string, value: string) => {
  if (type === 'team_env') {
    modelValue.value.team_env = { ...modelValue.value.team_env, [key]: value }
  } else if (type === 'team_headers') {
    modelValue.value.team_headers = { ...modelValue.value.team_headers, [key]: value }
  } else if (type === 'team_url_query_params') {
    modelValue.value.team_url_query_params = { ...modelValue.value.team_url_query_params, [key]: value }
  } else if (type === 'user_args') {
    modelValue.value.user_args = { ...modelValue.value.user_args, [key]: value }
  } else if (type === 'user_env') {
    modelValue.value.user_env = { ...modelValue.value.user_env, [key]: value }
  } else if (type === 'user_headers') {
    modelValue.value.user_headers = { ...modelValue.value.user_headers, [key]: value }
  } else if (type === 'user_url_query_params') {
    modelValue.value.user_url_query_params = { ...modelValue.value.user_url_query_params, [key]: value }
  }
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="hasAnyConfiguration" class="space-y-6">
      <!-- Team Arguments Section -->
      <div v-if="hasTeamArgs">
        <div class="mb-4">
          <h3 class="text-lg font-semibold">
            {{ t('mcpInstallations.teamConfiguration.sections.teamArgs.title') }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ teamArgsSchema.length }} {{ teamArgsSchema.length === 1 ? t('mcpInstallations.teamConfiguration.sections.teamArgs.counter.single') : t('mcpInstallations.teamConfiguration.sections.teamArgs.counter.plural') }}
          </p>
        </div>
        <p class="text-sm text-muted-foreground mb-6">
          {{ t('mcpInstallations.teamConfiguration.sections.teamArgs.description') }}
        </p>

        <div class="space-y-3">
          <Item
            v-for="(arg, index) in teamArgsSchema"
            :key="`arg_${index}`"
            variant="filled"
          >
            <div class="space-y-2 w-full">
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
          </Item>
        </div>
      </div>

      <!-- Team Environment Variables Section -->
      <div v-if="hasTeamEnvVars">
        <div class="mb-4">
          <h3 class="text-lg font-semibold">
            {{ t('mcpInstallations.teamConfiguration.sections.teamEnv.title') }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ teamEnvSchema.length }} {{ teamEnvSchema.length === 1 ? t('mcpInstallations.teamConfiguration.sections.teamEnv.counter.single') : t('mcpInstallations.teamConfiguration.sections.teamEnv.counter.plural') }}
          </p>
        </div>
        <p class="text-sm text-muted-foreground mb-6">
          {{ t('mcpInstallations.teamConfiguration.sections.teamEnv.description') }}
        </p>

        <div class="space-y-3">
          <Item
            v-for="envVar in teamEnvSchema"
            :key="envVar.name"
            variant="filled"
          >
            <div class="space-y-2 w-full">
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

              <!-- Boolean select -->
              <Select
                v-if="isBoolean(envVar)"
                :model-value="modelValue.team_env[envVar.name]"
                @update:model-value="(val) => updateBooleanValue('team_env', envVar.name, String(val))"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">false</SelectItem>
                  <SelectItem value="true">true</SelectItem>
                </SelectContent>
              </Select>

              <!-- Textarea for long values -->
              <div v-else-if="isTextarea(envVar)" class="relative">
                <Textarea
                  :id="`team_${envVar.name}`"
                  v-model="modelValue.team_env[envVar.name]"
                  :placeholder="envVar.placeholder || t('mcpInstallations.teamConfiguration.editModal.form.placeholders.enterValue')"
                  class="min-h-[100px]"
                  :required="envVar.required"
                />
              </div>

              <!-- Regular input -->
              <div v-else class="relative">
                <Input
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
          </Item>
        </div>
      </div>

      <!-- Team Headers Section -->
      <div v-if="hasTeamHeaders">
        <div class="mb-4">
          <h3 class="text-lg font-semibold">
            Team Headers
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ teamHeadersSchema.length }} {{ teamHeadersSchema.length === 1 ? 'header' : 'headers' }}
          </p>
        </div>
        <p class="text-sm text-muted-foreground mb-6">
          Configure HTTP headers that will be shared across all team members for this MCP server installation.
        </p>

        <div class="space-y-3">
          <Item
            v-for="header in teamHeadersSchema"
            :key="header.name"
            variant="filled"
          >
            <div class="space-y-2 w-full">
              <div class="flex items-center gap-2">
                <Label :for="`team_header_${header.name}`" class="flex items-center gap-2">
                  {{ header.name }}
                  <span v-if="header.required" class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.required') }}
                  </span>
                  <span v-else class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.optional') }}
                  </span>
                  <span v-if="header.visible_to_users === false" class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.table.values.hiddenFromUsers') }}
                  </span>
                </Label>
              </div>

              <div v-if="header.description" class="text-sm text-gray-600">
                {{ header.description }}
              </div>

              <!-- Boolean select -->
              <Select
                v-if="isBoolean(header)"
                :model-value="modelValue.team_headers[header.name]"
                @update:model-value="(val) => updateBooleanValue('team_headers', header.name, String(val))"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">false</SelectItem>
                  <SelectItem value="true">true</SelectItem>
                </SelectContent>
              </Select>

              <!-- Regular input -->
              <div v-else class="relative">
                <Input
                  :id="`team_header_${header.name}`"
                  :type="getInputType(header)"
                  v-model="modelValue.team_headers[header.name]"
                  :placeholder="header.placeholder || 'Enter header value'"
                  :required="header.required"
                />
              </div>

              <div v-if="header.type" class="text-xs text-gray-500">
                {{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ header.type }}</code>
              </div>
            </div>
          </Item>
        </div>
      </div>

      <!-- Team URL Query Parameters Section -->
      <div v-if="hasTeamQueryParams">
        <div class="mb-4">
          <h3 class="text-lg font-semibold">
            Team URL Query Parameters
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ teamQueryParamsSchema.length }} {{ teamQueryParamsSchema.length === 1 ? 'query parameter' : 'query parameters' }}
          </p>
        </div>
        <p class="text-sm text-muted-foreground mb-6">
          Configure URL query parameters that will be shared across all team members for this MCP server installation.
        </p>

        <div class="space-y-3">
          <Item
            v-for="param in teamQueryParamsSchema"
            :key="param.name"
            variant="filled"
          >
            <div class="space-y-2 w-full">
              <div class="flex items-center gap-2">
                <Label :for="`team_query_param_${param.name}`" class="flex items-center gap-2">
                  {{ param.name }}
                  <span v-if="param.required" class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.required') }}
                  </span>
                  <span v-else class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.optional') }}
                  </span>
                  <span v-if="param.visible_to_users === false" class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.table.values.hiddenFromUsers') }}
                  </span>
                </Label>
              </div>

              <div v-if="param.description" class="text-sm text-gray-600">
                {{ param.description }}
              </div>

              <!-- Boolean select -->
              <Select
                v-if="isBoolean(param)"
                :model-value="modelValue.team_url_query_params[param.name]"
                @update:model-value="(val) => updateBooleanValue('team_url_query_params', param.name, String(val))"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">false</SelectItem>
                  <SelectItem value="true">true</SelectItem>
                </SelectContent>
              </Select>

              <!-- Regular input -->
              <div v-else class="relative">
                <Input
                  :id="`team_query_param_${param.name}`"
                  :type="getInputType(param)"
                  v-model="modelValue.team_url_query_params[param.name]"
                  :placeholder="param.placeholder || 'Enter query parameter value'"
                  :required="param.required"
                />
              </div>

              <div v-if="param.type" class="text-xs text-gray-500">
                {{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ param.type }}</code>
              </div>
            </div>
          </Item>
        </div>
      </div>

      <!-- User Arguments Section -->
      <div v-if="hasUserArgs">
        <div class="mb-4">
          <h3 class="text-lg font-semibold">
            {{ t('mcpInstallations.teamConfiguration.sections.userArgs.title') }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ userArgsSchema.length }} {{ userArgsSchema.length === 1 ? 'argument' : 'arguments' }}
          </p>
        </div>
        <p class="text-sm text-muted-foreground mb-6">
          Your personal command line arguments for this MCP server.
        </p>

        <div class="space-y-3">
          <Item
            v-for="arg in userArgsSchema"
            :key="`user_arg_${arg.name}`"
            variant="filled"
          >
            <div class="space-y-2 w-full">
              <div class="flex items-center gap-2">
                <Label :for="`user_arg_${arg.name}`" class="flex items-center gap-2">
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

              <!-- Boolean select -->
              <Select
                v-if="isBoolean(arg)"
                :model-value="modelValue.user_args[arg.name]"
                @update:model-value="(val) => updateBooleanValue('user_args', arg.name, String(val))"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">false</SelectItem>
                  <SelectItem value="true">true</SelectItem>
                </SelectContent>
              </Select>

              <!-- Regular input -->
              <div v-else class="relative">
                <Input
                  :id="`user_arg_${arg.name}`"
                  :type="getArgInputType(arg)"
                  v-model="modelValue.user_args[arg.name]"
                  :placeholder="arg.placeholder || t('mcpInstallations.teamConfiguration.editModal.form.placeholders.enterValue')"
                />
              </div>

              <div v-if="arg.type" class="text-xs text-gray-500">
                {{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ arg.type }}</code>
              </div>
            </div>
          </Item>
        </div>
      </div>

      <!-- User Environment Variables Section -->
      <div v-if="hasUserEnvVars">
        <div class="mb-4">
          <h3 class="text-lg font-semibold">
            {{ t('mcpInstallations.teamConfiguration.sections.userEnv.title') }}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ userEnvSchema.length }} {{ userEnvSchema.length === 1 ? 'variable' : 'variables' }}
          </p>
        </div>
        <p class="text-sm text-muted-foreground mb-6">
          Your personal environment variables for this MCP server.
        </p>

        <div class="space-y-3">
          <Item
            v-for="envVar in userEnvSchema"
            :key="`user_env_${envVar.name}`"
            variant="filled"
          >
            <div class="space-y-2 w-full">
              <div class="flex items-center gap-2">
                <Label :for="`user_env_${envVar.name}`" class="flex items-center gap-2">
                  {{ envVar.name }}
                  <span v-if="envVar.required" class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.required') }}
                  </span>
                  <span v-else class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.optional') }}
                  </span>
                </Label>
              </div>

              <div v-if="envVar.description" class="text-sm text-gray-600">
                {{ envVar.description }}
              </div>

              <!-- Boolean select -->
              <Select
                v-if="isBoolean(envVar)"
                :model-value="modelValue.user_env[envVar.name]"
                @update:model-value="(val) => updateBooleanValue('user_env', envVar.name, String(val))"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">false</SelectItem>
                  <SelectItem value="true">true</SelectItem>
                </SelectContent>
              </Select>

              <!-- Textarea for long values -->
              <div v-else-if="isTextarea(envVar)" class="relative">
                <Textarea
                  :id="`user_env_${envVar.name}`"
                  v-model="modelValue.user_env[envVar.name]"
                  :placeholder="envVar.placeholder || t('mcpInstallations.teamConfiguration.editModal.form.placeholders.enterValue')"
                  class="min-h-[100px]"
                />
              </div>

              <!-- Regular input -->
              <div v-else class="relative">
                <Input
                  :id="`user_env_${envVar.name}`"
                  :type="getInputType(envVar)"
                  v-model="modelValue.user_env[envVar.name]"
                  :placeholder="envVar.placeholder || t('mcpInstallations.teamConfiguration.editModal.form.placeholders.enterValue')"
                />
              </div>

              <div v-if="envVar.type" class="text-xs text-gray-500">
                {{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ envVar.type }}</code>
              </div>
            </div>
          </Item>
        </div>
      </div>

      <!-- User Headers Section -->
      <div v-if="hasUserHeaders">
        <div class="mb-4">
          <h3 class="text-lg font-semibold">
            User Headers
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ userHeadersSchema.length }} {{ userHeadersSchema.length === 1 ? 'header' : 'headers' }}
          </p>
        </div>
        <p class="text-sm text-muted-foreground mb-6">
          Your personal HTTP headers for this MCP server.
        </p>

        <div class="space-y-3">
          <Item
            v-for="header in userHeadersSchema"
            :key="`user_header_${header.name}`"
            variant="filled"
          >
            <div class="space-y-2 w-full">
              <div class="flex items-center gap-2">
                <Label :for="`user_header_${header.name}`" class="flex items-center gap-2">
                  {{ header.name }}
                  <span v-if="header.required" class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.required') }}
                  </span>
                  <span v-else class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.optional') }}
                  </span>
                </Label>
              </div>

              <div v-if="header.description" class="text-sm text-gray-600">
                {{ header.description }}
              </div>

              <!-- Boolean select -->
              <Select
                v-if="isBoolean(header)"
                :model-value="modelValue.user_headers[header.name]"
                @update:model-value="(val) => updateBooleanValue('user_headers', header.name, String(val))"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">false</SelectItem>
                  <SelectItem value="true">true</SelectItem>
                </SelectContent>
              </Select>

              <!-- Regular input -->
              <div v-else class="relative">
                <Input
                  :id="`user_header_${header.name}`"
                  :type="getInputType(header)"
                  v-model="modelValue.user_headers[header.name]"
                  :placeholder="header.placeholder || 'Enter header value'"
                />
              </div>

              <div v-if="header.type" class="text-xs text-gray-500">
                {{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ header.type }}</code>
              </div>
            </div>
          </Item>
        </div>
      </div>

      <!-- User URL Query Parameters Section -->
      <div v-if="hasUserQueryParams">
        <div class="mb-4">
          <h3 class="text-lg font-semibold">
            User URL Query Parameters
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {{ userQueryParamsSchema.length }} {{ userQueryParamsSchema.length === 1 ? 'query parameter' : 'query parameters' }}
          </p>
        </div>
        <p class="text-sm text-muted-foreground mb-6">
          Your personal URL query parameters for this MCP server.
        </p>

        <div class="space-y-3">
          <Item
            v-for="param in userQueryParamsSchema"
            :key="`user_query_param_${param.name}`"
            variant="filled"
          >
            <div class="space-y-2 w-full">
              <div class="flex items-center gap-2">
                <Label :for="`user_query_param_${param.name}`" class="flex items-center gap-2">
                  {{ param.name }}
                  <span v-if="param.required" class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.required') }}
                  </span>
                  <span v-else class="text-xs text-gray-500">
                    {{ t('mcpInstallations.teamConfiguration.userEnvDetails.optional') }}
                  </span>
                </Label>
              </div>

              <div v-if="param.description" class="text-sm text-gray-600">
                {{ param.description }}
              </div>

              <!-- Boolean select -->
              <Select
                v-if="isBoolean(param)"
                :model-value="modelValue.user_url_query_params[param.name]"
                @update:model-value="(val) => updateBooleanValue('user_url_query_params', param.name, String(val))"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select value" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">false</SelectItem>
                  <SelectItem value="true">true</SelectItem>
                </SelectContent>
              </Select>

              <!-- Regular input -->
              <div v-else class="relative">
                <Input
                  :id="`user_query_param_${param.name}`"
                  :type="getInputType(param)"
                  v-model="modelValue.user_url_query_params[param.name]"
                  :placeholder="param.placeholder || 'Enter query parameter value'"
                />
              </div>

              <div v-if="param.type" class="text-xs text-gray-500">
                {{ t('mcpInstallations.teamConfiguration.userEnvDetails.typeLabel') }} <code class="bg-gray-100 px-1 rounded">{{ param.type }}</code>
              </div>
            </div>
          </Item>
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
