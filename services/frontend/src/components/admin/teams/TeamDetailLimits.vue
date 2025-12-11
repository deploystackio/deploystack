<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { DsCard } from '@/components/ui/ds-card'
import type { Team } from '@/views/admin/teams/types'

defineProps<{
  team: Team
}>()

const { t } = useI18n()
</script>

<template>
  <DsCard :title="t('adminTeams.teamDetail.fields.limits')">
    <p class="text-sm text-muted-foreground mb-6">
      Configure resource limits for this team's MCP server usage.
    </p>

    <dl class="divide-y divide-gray-100">
      <!-- Total MCP Server Limit -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.totalMcpLimit') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          {{ team.mcp_server_limit }}
        </dd>
      </div>

      <!-- Non-HTTP MCP Limit -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm font-medium text-gray-900">{{ t('adminTeams.teamDetail.fields.mcpLimit') }}</dt>
        <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
          {{ team.non_http_mcp_limit }}
        </dd>
      </div>
    </dl>
  </DsCard>
</template>
