<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { DsCard } from '@/components/ui/ds-card'
import { TeamService } from '@/services/teamService'
import type { Team } from '@/views/admin/teams/types'

const props = defineProps<{
  team: Team
}>()

const emit = defineEmits<{
  updated: [team: Team]
}>()

const { t } = useI18n()

// Form state
const mcpServerLimit = ref(props.team.mcp_server_limit)
const nonHttpMcpLimit = ref(props.team.non_http_mcp_limit)
const isSaving = ref(false)
const errors = ref<Record<string, string>>({})

// Watch for team prop changes
watch(() => props.team, (newTeam) => {
  mcpServerLimit.value = newTeam.mcp_server_limit
  nonHttpMcpLimit.value = newTeam.non_http_mcp_limit
}, { deep: true })

// Check if form has changes
const hasChanges = () => {
  return mcpServerLimit.value !== props.team.mcp_server_limit ||
         nonHttpMcpLimit.value !== props.team.non_http_mcp_limit
}

// Save limits
const saveLimits = async () => {
  errors.value = {}

  // Validate
  if (mcpServerLimit.value < 0) {
    errors.value.mcp_server_limit = t('adminTeams.teamEdit.form.mcpLimitMin')
    return
  }
  if (nonHttpMcpLimit.value < 0) {
    errors.value.non_http_mcp_limit = t('adminTeams.teamEdit.form.mcpLimitMin')
    return
  }

  // Skip if unchanged
  if (!hasChanges()) {
    return
  }

  try {
    isSaving.value = true
    const updates: { mcp_server_limit?: number; non_http_mcp_limit?: number } = {}

    if (mcpServerLimit.value !== props.team.mcp_server_limit) {
      updates.mcp_server_limit = mcpServerLimit.value
    }
    if (nonHttpMcpLimit.value !== props.team.non_http_mcp_limit) {
      updates.non_http_mcp_limit = nonHttpMcpLimit.value
    }

    const updatedTeam = await TeamService.updateTeamAsAdmin(props.team.id, updates)
    toast.success(t('adminTeams.teamEdit.success'))
    emit('updated', updatedTeam)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    toast.error(t('adminTeams.teamEdit.error', { error: errorMessage }))
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <DsCard :title="t('adminTeams.teamDetail.fields.limits')">
    <p class="text-sm text-muted-foreground mb-6">
      Configure resource limits for this team's MCP server usage.
    </p>

    <div class="space-y-6">
      <!-- Total MCP Server Limit -->
      <div class="space-y-2">
        <Label for="mcp_server_limit">
          {{ t('adminTeams.teamEdit.form.totalMcpLimit') }}
        </Label>
        <Input
          id="mcp_server_limit"
          v-model.number="mcpServerLimit"
          type="number"
          min="0"
          :disabled="isSaving"
          :class="{ 'border-red-500': errors.mcp_server_limit }"
        />
        <p class="text-sm text-muted-foreground">
          {{ t('adminTeams.teamEdit.form.totalMcpLimitHelp') }}
        </p>
        <p v-if="errors.mcp_server_limit" class="text-sm text-red-500">
          {{ errors.mcp_server_limit }}
        </p>
      </div>

      <!-- Non-HTTP MCP Limit -->
      <div class="space-y-2">
        <Label for="non_http_mcp_limit">
          {{ t('adminTeams.teamEdit.form.mcpLimit') }}
        </Label>
        <Input
          id="non_http_mcp_limit"
          v-model.number="nonHttpMcpLimit"
          type="number"
          min="0"
          :disabled="isSaving"
          :class="{ 'border-red-500': errors.non_http_mcp_limit }"
        />
        <p class="text-sm text-muted-foreground">
          {{ t('adminTeams.teamEdit.form.mcpLimitHelp') }}
        </p>
        <p v-if="errors.non_http_mcp_limit" class="text-sm text-red-500">
          {{ errors.non_http_mcp_limit }}
        </p>
      </div>
    </div>

    <template #footer-actions>
      <Button :disabled="isSaving || !hasChanges()" @click="saveLimits">
        <Spinner v-if="isSaving" class="mr-2" />
        {{ t('adminTeams.teamEdit.form.submit') }}
      </Button>
    </template>
  </DsCard>
</template>
