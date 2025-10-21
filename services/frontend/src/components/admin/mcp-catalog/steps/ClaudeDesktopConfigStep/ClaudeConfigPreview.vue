<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'

interface Props {
  serverName: string
  command?: string
  url?: string
  type?: string
  headers: string[]
  envVars: string[]
  isUrlBasedServer: boolean
}

defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <Card class="border-green-200 bg-green-50">
    <CardHeader>
      <CardTitle class="text-sm text-green-800">
        {{ t('mcpCatalog.form.claudeConfig.preview.title') }}
      </CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <div>
        <Label class="text-xs text-green-700">
          {{ t('mcpCatalog.form.claudeConfig.preview.serverName') }}
        </Label>
        <Badge variant="outline" class="ml-2">{{ serverName }}</Badge>
      </div>
      
      <div v-if="!isUrlBasedServer && command">
        <Label class="text-xs text-green-700">
          {{ t('mcpCatalog.form.claudeConfig.preview.command') }}
        </Label>
        <code class="ml-2 text-sm bg-green-100 px-2 py-1 rounded">{{ command }}</code>
      </div>
      
      <div v-if="isUrlBasedServer && url">
        <Label class="text-xs text-green-700">
          {{ t('mcpCatalog.form.claudeConfig.preview.url') }}
        </Label>
        <code class="ml-2 text-sm bg-green-100 px-2 py-1 rounded">{{ url }}</code>
      </div>
      
      <div v-if="isUrlBasedServer && type">
        <Label class="text-xs text-green-700">
          {{ t('mcpCatalog.form.claudeConfig.preview.type') }}
        </Label>
        <Badge variant="outline" class="ml-2">{{ type }}</Badge>
      </div>
      
      <div v-if="isUrlBasedServer && headers.length > 0">
        <Label class="text-xs text-green-700">
          {{ t('mcpCatalog.form.claudeConfig.preview.headers') }}
        </Label>
        <div class="flex flex-wrap gap-1 mt-1">
          <Badge v-for="header in headers" :key="header" variant="secondary" class="text-xs">
            {{ header }}
          </Badge>
        </div>
      </div>
      
      <div v-if="envVars.length > 0">
        <Label class="text-xs text-green-700">
          {{ t('mcpCatalog.form.claudeConfig.preview.environmentVariables') }}
        </Label>
        <div class="flex flex-wrap gap-1 mt-1">
          <Badge v-for="envVar in envVars" :key="envVar" variant="secondary" class="text-xs">
            {{ envVar }}
          </Badge>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
