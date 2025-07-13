<script setup lang="ts">
import { computed } from 'vue'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-vue-next'
import type {
  TechnicalFormData
} from '@/views/admin/mcp-server-catalog/types'

interface Props {
  modelValue: TechnicalFormData
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any
}

interface Emits {
  (e: 'update:modelValue', value: TechnicalFormData): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// Import options from types
const languageOptions = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'other', label: 'Other' }
]

const runtimeOptions = [
  { value: 'node', label: 'Node.js' },
  { value: 'python', label: 'Python' },
  { value: 'docker', label: 'Docker' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'dotnet', label: '.NET' },
  { value: 'other', label: 'Other' }
]

// Computed model
const localValue = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Claude Desktop configuration as JSON string
const claudeDesktopConfig = computed({
  get: () => {
    // Convert installation_methods array to Claude Desktop JSON format
    if (localValue.value.installation_methods.length === 0) {
      return JSON.stringify({
        "mcpServers": {
          "server-name": {
            "command": "npx",
            "args": ["@package/name"],
            "env": {
              "API_TOKEN": "<your-api-token>"
            }
          }
        }
      }, null, 2)
    }

    // Convert existing data to Claude Desktop format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mcpServers: Record<string, any> = {}
    localValue.value.installation_methods.forEach((method, index) => {
      const serverName = `server-${index + 1}`
      mcpServers[serverName] = {
        command: method.command,
        args: method.args || [],
        env: method.env || {}
      }
    })

    return JSON.stringify({ mcpServers }, null, 2)
  },
  set: (jsonString: string) => {
    // Don't try to parse empty or whitespace-only strings
    if (!jsonString.trim()) {
      return
    }

    try {
      const parsed = JSON.parse(jsonString)

      // Extract mcpServers from the JSON
      const mcpServers = parsed.mcpServers || {}

      // Convert to installation_methods array
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const installationMethods = Object.entries(mcpServers).map(([, config]: [string, any]) => ({
        client: 'claude-desktop' as const,
        command: config.command || 'npx',
        args: config.args || [],
        env: config.env || {}
      }))

      localValue.value = {
        ...localValue.value,
        installation_methods: installationMethods
      }
    } catch {
      // Invalid JSON - silently ignore while user is typing
      // No logging to avoid console spam
    }
  }
})

const exampleConfig = `{
  "mcpServers": {
    "brightdata": {
      "command": "npx",
      "args": ["-y", "@brightdata/mcp"],
      "env": {
        "API_TOKEN": "<your-bright-data-api-token>"
      }
    }
  }
}`
</script>

<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium">{{ t('mcpCatalog.form.technical.title') }}</h3>
      <p class="text-sm text-muted-foreground">{{ t('mcpCatalog.form.technical.subtitle') }}</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Programming Language -->
      <div class="space-y-2">
        <Label for="language">{{ t('mcpCatalog.form.technical.language.label') }}</Label>
        <Select v-model="localValue.language">
          <SelectTrigger>
            <SelectValue :placeholder="t('mcpCatalog.form.technical.language.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in languageOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.technical.language.description') }}
        </p>
      </div>

      <!-- Runtime Environment -->
      <div class="space-y-2">
        <Label for="runtime">{{ t('mcpCatalog.form.technical.runtime.label') }}</Label>
        <Select v-model="localValue.runtime">
          <SelectTrigger>
            <SelectValue :placeholder="t('mcpCatalog.form.technical.runtime.placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in runtimeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          {{ t('mcpCatalog.form.technical.runtime.description') }}
        </p>
      </div>
    </div>

    <!-- Minimum Runtime Version -->
    <div class="space-y-2">
      <Label for="runtime_min_version">{{ t('mcpCatalog.form.technical.minVersion.label') }}</Label>
      <Input
        id="runtime_min_version"
        v-model="localValue.runtime_min_version"
        :placeholder="t('mcpCatalog.form.technical.minVersion.placeholder')"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('mcpCatalog.form.technical.minVersion.description') }}
      </p>
    </div>

    <!-- Claude Desktop Configuration -->
    <div class="space-y-4">
      <div>
        <Label>Claude Desktop Configuration</Label>
        <p class="text-xs text-muted-foreground">
          Paste the complete Claude Desktop configuration JSON. You can copy this from GitHub repositories or documentation.
        </p>
      </div>

      <!-- Client Type (Fixed to Claude Desktop) -->
      <div class="space-y-2">
        <Label>Client Type</Label>
        <Select model-value="claude-desktop" disabled>
          <SelectTrigger>
            <SelectValue placeholder="Claude Desktop" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="claude-desktop">Claude Desktop</SelectItem>
          </SelectContent>
        </Select>
        <p class="text-xs text-muted-foreground">
          Currently only Claude Desktop is supported. More clients will be added in the future.
        </p>
      </div>

      <!-- Configuration JSON Textarea -->
      <div class="space-y-2">
        <Label>Configuration JSON</Label>
        <Textarea
          v-model="claudeDesktopConfig"
          placeholder="Paste Claude Desktop configuration JSON here..."
          rows="12"
          class="font-mono text-sm"
        />
        <p class="text-xs text-muted-foreground">
          Paste the complete <code class="bg-muted px-1 rounded">claude_desktop_config.json</code> content here.
        </p>
      </div>

      <!-- Example Configuration -->
      <Alert>
        <Info class="h-4 w-4" />
        <AlertDescription>
          <div class="space-y-2">
            <p class="font-medium">Example Configuration:</p>
            <pre class="text-xs bg-muted p-3 rounded mt-2 overflow-x-auto">{{ exampleConfig }}</pre>
            <p class="text-xs">
              You can copy configurations like this from GitHub repositories or the Claude Desktop documentation.
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>

    <!-- Dependencies -->
    <div class="space-y-2">
      <Label for="dependencies">{{ t('mcpCatalog.form.technical.dependencies.label') }}</Label>
      <Textarea
        id="dependencies"
        v-model="localValue.dependencies"
        :placeholder="t('mcpCatalog.form.technical.dependencies.placeholder')"
        rows="4"
      />
      <p class="text-xs text-muted-foreground">
        {{ t('mcpCatalog.form.technical.dependencies.description') }}
      </p>
    </div>
  </div>
</template>
