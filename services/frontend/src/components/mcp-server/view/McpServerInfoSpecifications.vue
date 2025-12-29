<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { CodeHighlight } from '@/components/ui/code-highlight'
import { Shield, Package, Globe } from 'lucide-vue-next'

interface Props {
  requiresOauth?: boolean | null
  runtime: string
  showHeading?: boolean

  // Keep for backward compatibility (will use to extract base URL)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remotes?: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packages?: any | null

  // Template Level (can be array, object, or string depending on API source)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templateArgs?: any[] | Record<string, any> | string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templateEnv?: any[] | Record<string, any> | string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templateHeaders?: any[] | Record<string, any> | string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templateUrlQueryParams?: any[] | Record<string, any> | string | null

  // Team Level Schemas (can be array or string depending on API source)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teamArgsSchema?: any[] | string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teamEnvSchema?: any[] | string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teamHeadersSchema?: any[] | string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  teamUrlQueryParamsSchema?: any[] | string | null

  // User Level Schemas (can be array or string depending on API source)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userArgsSchema?: any[] | string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userEnvSchema?: any[] | string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userHeadersSchema?: any[] | string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  userUrlQueryParamsSchema?: any[] | string | null
}

const props = withDefaults(defineProps<Props>(), {
  showHeading: true
})

// Assemble final specification
const assembledSpecification = computed(() => {
  if (props.runtime === 'http') {
    // HTTP Server Assembly
    if (!props.remotes || !Array.isArray(props.remotes) || props.remotes.length === 0) {
      return null
    }

    const remote = props.remotes[0]

    // Extract base URL (remove query params)
    let baseUrl = remote.url || ''
    try {
      const url = new URL(baseUrl)
      baseUrl = `${url.protocol}//${url.host}${url.pathname}`
    } catch {
      // If URL parsing fails, use as-is
    }

    // Merge headers from all 3 tiers
    const headers: Record<string, string> = {}

    // Template headers (actual values) - handle both array and object formats
    if (props.templateHeaders) {
      if (Array.isArray(props.templateHeaders)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        props.templateHeaders.forEach((header: any) => {
          if (header.name) {
            headers[header.name] = header.value || ''
          }
        })
      } else if (typeof props.templateHeaders === 'object') {
        Object.entries(props.templateHeaders).forEach(([key, value]) => {
          headers[key] = String(value || '')
        })
      }
    }

    // Team headers schema (placeholder values)
    if (props.teamHeadersSchema && Array.isArray(props.teamHeadersSchema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props.teamHeadersSchema.forEach((schema: any) => {
        if (schema.name) {
          headers[schema.name] = schema.default || ''
        }
      })
    }

    // User headers schema (placeholder values)
    if (props.userHeadersSchema && Array.isArray(props.userHeadersSchema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props.userHeadersSchema.forEach((schema: any) => {
        if (schema.name) {
          headers[schema.name] = schema.default || ''
        }
      })
    }

    // Merge query params from all 3 tiers
    const queryParams: Record<string, string> = {}

    // Template query params (actual values) - handle both array and object formats
    if (props.templateUrlQueryParams) {
      if (Array.isArray(props.templateUrlQueryParams)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        props.templateUrlQueryParams.forEach((param: any) => {
          if (param.name) {
            queryParams[param.name] = param.value || ''
          }
        })
      } else if (typeof props.templateUrlQueryParams === 'object') {
        Object.entries(props.templateUrlQueryParams).forEach(([key, value]) => {
          queryParams[key] = String(value || '')
        })
      }
    }

    // Team query params schema (placeholder values)
    if (props.teamUrlQueryParamsSchema && Array.isArray(props.teamUrlQueryParamsSchema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props.teamUrlQueryParamsSchema.forEach((schema: any) => {
        if (schema.name) {
          queryParams[schema.name] = schema.default || 'YOUR_API_TOKEN_HERE'
        }
      })
    }

    // User query params schema (placeholder values)
    if (props.userUrlQueryParamsSchema && Array.isArray(props.userUrlQueryParamsSchema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props.userUrlQueryParamsSchema.forEach((schema: any) => {
        if (schema.name) {
          queryParams[schema.name] = schema.default || ''
        }
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec: any = {
      type: remote.type || 'streamable-http',
      url: baseUrl
    }

    if (Object.keys(headers).length > 0) {
      spec.headers = headers
    }

    if (Object.keys(queryParams).length > 0) {
      spec.query_params = queryParams
    }

    return spec
  } else {
    // STDIO Server Assembly
    if (!props.packages || !Array.isArray(props.packages) || props.packages.length === 0) {
      return null
    }

    const pkg = props.packages[0]

    // Extract command (usually "npx" or "node")
    const command = typeof pkg === 'string' ? pkg.split(' ')[0] : 'npx'

    // Merge args from all 3 tiers
    const args: string[] = []

    // Template args (actual values) - handle both array and object formats
    if (props.templateArgs) {
      if (Array.isArray(props.templateArgs)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        props.templateArgs.forEach((arg: any) => {
          if (typeof arg === 'string') {
            args.push(arg)
          } else if (arg.value) {
            args.push(arg.value)
          }
        })
      } else if (typeof props.templateArgs === 'object') {
        Object.values(props.templateArgs).forEach((value) => {
          if (value) {
            args.push(String(value))
          }
        })
      }
    }

    // Team args schema (placeholder values)
    if (props.teamArgsSchema && Array.isArray(props.teamArgsSchema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props.teamArgsSchema.forEach((schema: any) => {
        args.push(schema.default || `<${schema.name}>`)
      })
    }

    // User args schema (placeholder values)
    if (props.userArgsSchema && Array.isArray(props.userArgsSchema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props.userArgsSchema.forEach((schema: any) => {
        args.push(schema.default || `<${schema.name}>`)
      })
    }

    // Merge env from all 3 tiers
    const env: Record<string, string> = {}

    // Template env (actual values) - handle both array and object formats
    if (props.templateEnv) {
      if (Array.isArray(props.templateEnv)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        props.templateEnv.forEach((envVar: any) => {
          if (envVar.name) {
            env[envVar.name] = envVar.value || ''
          }
        })
      } else if (typeof props.templateEnv === 'object') {
        Object.entries(props.templateEnv).forEach(([key, value]) => {
          env[key] = String(value || '')
        })
      }
    }

    // Team env schema (placeholder values)
    if (props.teamEnvSchema && Array.isArray(props.teamEnvSchema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props.teamEnvSchema.forEach((schema: any) => {
        if (schema.name) {
          env[schema.name] = schema.default || ''
        }
      })
    }

    // User env schema (placeholder values)
    if (props.userEnvSchema && Array.isArray(props.userEnvSchema)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props.userEnvSchema.forEach((schema: any) => {
        if (schema.name) {
          env[schema.name] = schema.default || ''
        }
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spec: any = {
      command
    }

    if (args.length > 0) {
      spec.args = args
    }

    if (Object.keys(env).length > 0) {
      spec.env = env
    }

    return spec
  }
})

const formattedSpecification = computed(() => {
  if (!assembledSpecification.value) return ''
  return JSON.stringify(assembledSpecification.value, null, 2)
})
</script>

<template>
  <div class="space-y-3">
    <h3 v-if="showHeading" class="text-sm font-semibold">Specifications</h3>

    <div class="space-y-3">
      <!-- Requires OAuth -->
      <div v-if="requiresOauth" class="space-y-1">
        <dt class="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Shield class="h-3 w-3" />
          Authentication
        </dt>
        <dd class="text-sm">
          <Badge variant="default" class="text-xs">
            Requires OAuth
          </Badge>
        </dd>
      </div>

      <!-- Assembled Specification -->
      <div v-if="assembledSpecification" class="space-y-1">
        <dt class="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Package v-if="runtime !== 'http'" class="h-3 w-3" />
          <Globe v-else class="h-3 w-3" />
          {{ runtime === 'http' ? 'Remote Configuration' : 'Package Configuration' }}
        </dt>
        <dd class="text-sm">
          <CodeHighlight :code="formattedSpecification" language="json" />
        </dd>
      </div>
    </div>
  </div>
</template>
