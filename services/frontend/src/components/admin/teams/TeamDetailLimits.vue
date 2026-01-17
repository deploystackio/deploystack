<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
const memberLimit = ref(props.team.member_limit)
const allowGithubMcp = ref(props.team.allow_github_mcp)
const allowPrivateGithubRepos = ref(props.team.allow_private_github_repos)
const githubMcpLimit = ref(props.team.github_mcp_limit)
const isSaving = ref(false)
const errors = ref<Record<string, string>>({})

// Watch for team prop changes
watch(() => props.team, (newTeam) => {
  mcpServerLimit.value = newTeam.mcp_server_limit
  nonHttpMcpLimit.value = newTeam.non_http_mcp_limit
  memberLimit.value = newTeam.member_limit
  allowGithubMcp.value = newTeam.allow_github_mcp
  allowPrivateGithubRepos.value = newTeam.allow_private_github_repos
  githubMcpLimit.value = newTeam.github_mcp_limit
}, { deep: true })

// Check if form has changes
const hasChanges = () => {
  return mcpServerLimit.value !== props.team.mcp_server_limit ||
         nonHttpMcpLimit.value !== props.team.non_http_mcp_limit ||
         memberLimit.value !== props.team.member_limit ||
         allowGithubMcp.value !== props.team.allow_github_mcp ||
         allowPrivateGithubRepos.value !== props.team.allow_private_github_repos ||
         githubMcpLimit.value !== props.team.github_mcp_limit
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
  if (memberLimit.value < 1) {
    errors.value.member_limit = 'Member limit must be at least 1'
    return
  }
  if (githubMcpLimit.value < 0) {
    errors.value.github_mcp_limit = 'GitHub MCP limit must be at least 0'
    return
  }

  // Skip if unchanged
  if (!hasChanges()) {
    return
  }

  try {
    isSaving.value = true
    const updates: {
      mcp_server_limit?: number
      non_http_mcp_limit?: number
      member_limit?: number
      allow_github_mcp?: boolean
      allow_private_github_repos?: boolean
      github_mcp_limit?: number
    } = {}

    if (mcpServerLimit.value !== props.team.mcp_server_limit) {
      updates.mcp_server_limit = mcpServerLimit.value
    }
    if (nonHttpMcpLimit.value !== props.team.non_http_mcp_limit) {
      updates.non_http_mcp_limit = nonHttpMcpLimit.value
    }
    if (memberLimit.value !== props.team.member_limit) {
      updates.member_limit = memberLimit.value
    }
    if (allowGithubMcp.value !== props.team.allow_github_mcp) {
      updates.allow_github_mcp = allowGithubMcp.value
    }
    if (allowPrivateGithubRepos.value !== props.team.allow_private_github_repos) {
      updates.allow_private_github_repos = allowPrivateGithubRepos.value
    }
    if (githubMcpLimit.value !== props.team.github_mcp_limit) {
      updates.github_mcp_limit = githubMcpLimit.value
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

      <!-- Member Limit -->
      <div class="space-y-2">
        <Label for="member_limit">
          Member Limit
        </Label>
        <Input
          id="member_limit"
          v-model.number="memberLimit"
          type="number"
          min="1"
          :disabled="isSaving"
          :class="{ 'border-red-500': errors.member_limit }"
        />
        <p class="text-sm text-muted-foreground">
          Maximum number of members allowed in this team
        </p>
        <p v-if="errors.member_limit" class="text-sm text-red-500">
          {{ errors.member_limit }}
        </p>
      </div>

      <!-- Allow GitHub MCP Servers -->
      <div class="space-y-2">
        <div class="flex items-center space-x-2">
          <Checkbox
            id="allow_github_mcp"
            :checked="allowGithubMcp"
            :disabled="isSaving"
            @update:checked="(value) => allowGithubMcp = value"
          />
          <Label for="allow_github_mcp" class="cursor-pointer">
            Allow GitHub MCP Servers
          </Label>
        </div>
        <p class="text-sm text-muted-foreground">
          Allow this team to install MCP servers directly from GitHub repositories
        </p>
      </div>

      <!-- Allow Private GitHub Repositories -->
      <div class="space-y-2">
        <div class="flex items-center space-x-2">
          <Checkbox
            id="allow_private_github_repos"
            :checked="allowPrivateGithubRepos"
            :disabled="isSaving"
            @update:checked="(value) => allowPrivateGithubRepos = value"
          />
          <Label for="allow_private_github_repos" class="cursor-pointer">
            Allow Private GitHub Repositories
          </Label>
        </div>
        <p class="text-sm text-muted-foreground">
          Allow this team to install MCP servers from private GitHub repositories
        </p>
      </div>

      <!-- GitHub MCP Server Limit -->
      <div class="space-y-2">
        <Label for="github_mcp_limit">
          GitHub MCP Server Limit
        </Label>
        <Input
          id="github_mcp_limit"
          v-model.number="githubMcpLimit"
          type="number"
          min="0"
          :disabled="isSaving"
          :class="{ 'border-red-500': errors.github_mcp_limit }"
        />
        <p class="text-sm text-muted-foreground">
          Maximum number of MCP servers that can be installed from GitHub repositories
        </p>
        <p v-if="errors.github_mcp_limit" class="text-sm text-red-500">
          {{ errors.github_mcp_limit }}
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
