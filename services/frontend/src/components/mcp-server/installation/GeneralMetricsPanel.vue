<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import InstallationStatusBadge from './InstallationStatusBadge.vue'
import type { InstallationStatusData } from '@/types/mcp-installations'

interface Props {
  statusData: InstallationStatusData | null
  installationType: string
  runtime: string
  toolCount: number
}

defineProps<Props>()
</script>

<template>
  <div class="border rounded-lg p-6">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
      <!-- MCP Status Metric -->
      <div class="flex flex-col gap-1">
        <span class="text-sm text-muted-foreground font-medium">
          MCP Status
        </span>
        <div class="flex items-baseline gap-1">
          <InstallationStatusBadge :status-data="statusData" />
        </div>
      </div>

      <!-- Runtime Metric -->
      <div class="flex flex-col gap-1 border-l pl-8">
        <span class="text-sm text-muted-foreground font-medium">
          Runtime
        </span>
        <div class="flex items-baseline gap-1">
          <Badge variant="outline">
            {{ runtime }}
          </Badge>
        </div>
      </div>

      <!-- Satellite Metric -->
      <div class="flex flex-col gap-1 border-l pl-8">
        <span class="text-sm text-muted-foreground font-medium">
          Satellite
        </span>
        <div class="flex items-baseline gap-1">
          <Badge :variant="installationType === 'global' ? 'default' : 'secondary'">
            {{ installationType }}
          </Badge>
        </div>
      </div>

      <!-- Tools Count Metric -->
      <div class="flex flex-col gap-1 border-l pl-8">
        <span class="text-sm text-muted-foreground font-medium">
          Tools
        </span>
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-normal">
            {{ toolCount }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
