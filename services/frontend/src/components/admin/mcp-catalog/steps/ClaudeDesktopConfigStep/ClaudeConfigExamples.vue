<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const { t } = useI18n()

const staticExample = `{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-sequential-thinking"
      ]
    }
  }
}`
</script>

<template>
  <div class="space-y-4">
    <h4 class="text-sm font-medium">{{ t('mcpCatalog.form.claudeConfig.examples.title') }}</h4>
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="text-sm">Configuration Example</CardTitle>
        <CardDescription class="text-xs">
          Basic MCP server configuration structure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <pre class="text-xs bg-muted p-2 rounded overflow-x-auto">{{ staticExample }}</pre>
      </CardContent>
    </Card>
  </div>
</template>
