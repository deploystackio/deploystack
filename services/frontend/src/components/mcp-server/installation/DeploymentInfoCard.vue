<script setup lang="ts">
import { computed, ref } from 'vue'
import { DsCard } from '@/components/ui/ds-card'
import { Button } from '@/components/ui/button'
import { ExternalLink, GitBranch, GitCommit, RefreshCw } from 'lucide-vue-next'
import ChangeBranchModal from './ChangeBranchModal.vue'
import RedeployModal from './RedeployModal.vue'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  userTeamRole: 'team_admin' | 'team_user' | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
}>()

// Only show for GitHub deployments
const isGithubDeployment = computed(() =>
  props.installation?.server?.source === 'github'
)

// Parse GitHub repository info
const githubInfo = computed(() => {
  if (!isGithubDeployment.value || !props.installation.server?.repository_url) {
    return null
  }

  const repoUrl = props.installation.server.repository_url
  const branch = props.installation.server.git_branch
  const commitSha = props.installation.server.git_commit_sha

  // Parse owner/repo from URL (e.g., https://github.com/owner/repo)
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/)
  if (!match || !match[1] || !match[2]) return null

  const owner = match[1]
  const repo = match[2]
  const cleanRepo = repo.replace(/\.git$/, '')

  // Clean URL by removing .git suffix if present
  const cleanRepoUrl = repoUrl.replace(/\.git$/, '')

  return {
    repoUrl: cleanRepoUrl,
    owner,
    repo: cleanRepo,
    branch,
    commitSha,
    branchUrl: branch ? `${cleanRepoUrl}/tree/${branch}` : null,
    commitUrl: commitSha ? `${cleanRepoUrl}/commit/${commitSha}` : null,
    shortSha: commitSha ? commitSha.substring(0, 7) : null
  }
})

// Modal state
const isChangeBranchModalOpen = ref(false)
const isRedeployModalOpen = ref(false)

// Local state for branch info (overrides prop data after update)
const localBranch = ref<string | null>(null)
const localCommitSha = ref<string | null>(null)

// Check if user can change branch
const canChangeBranch = computed(() => {
  // Only team admins can change branch
  if (props.userTeamRole !== 'team_admin') {
    return false
  }

  // Only GitHub-deployed servers
  if (props.installation.server?.source !== 'github') {
    return false
  }

  // Must have repository info
  if (!githubInfo.value?.owner || !githubInfo.value?.repo) {
    return false
  }

  return true
})

// Current branch - use local override if available, otherwise prop
const currentBranch = computed(() => localBranch.value || githubInfo.value?.branch)
const currentCommitSha = computed(() => localCommitSha.value || githubInfo.value?.commitSha)
const currentShortSha = computed(() => currentCommitSha.value ? currentCommitSha.value.substring(0, 7) : null)

// Handle branch change
function handleBranchChanged(data: { previous_branch: string; new_branch: string; commit_sha: string }) {
  // Update local state immediately with response data
  localBranch.value = data.new_branch
  localCommitSha.value = data.commit_sha

  // Also emit refresh event to parent for full data sync
  emit('refresh')
}

// Handle redeploy complete
function handleRedeployComplete(data: { previous_sha: string; new_sha: string; instances_notified: number }) {
  // Update local commit SHA with the new SHA
  localCommitSha.value = data.new_sha

  // Emit refresh event to parent for full data sync
  emit('refresh')
}

// Check if user can trigger redeploy (same logic as canChangeBranch)
const canRedeploy = computed(() => {
  // Only team admins can redeploy
  if (props.userTeamRole !== 'team_admin') {
    return false
  }

  // Only GitHub-deployed servers
  if (props.installation.server?.source !== 'github') {
    return false
  }

  // Must have repository info
  if (!githubInfo.value?.owner || !githubInfo.value?.repo) {
    return false
  }

  return true
})
</script>

<template>
  <DsCard v-if="isGithubDeployment && githubInfo" title="Deployment & Access">
    <dl class="divide-y divide-gray-100">
      <!-- Repository -->
      <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm/6 font-medium text-gray-900">Repository</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <a
            :href="githubInfo.repoUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-900 hover:underline inline-flex items-center gap-1"
          >
            {{ githubInfo.owner }}/{{ githubInfo.repo }}
            <ExternalLink class="h-3 w-3" />
          </a>
        </dd>
      </div>

      <!-- Branch -->
      <div v-if="currentBranch" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm/6 font-medium text-gray-900">Branch</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0 flex items-center justify-between">
          <div>
            <a
              v-if="githubInfo?.repoUrl && currentBranch"
              :href="`${githubInfo.repoUrl}/tree/${currentBranch}`"
              target="_blank"
              rel="noopener noreferrer"
              class="text-gray-900 hover:underline inline-flex items-center gap-1"
            >
              <GitBranch class="h-4 w-4" />
              {{ currentBranch }}
              <ExternalLink class="h-3 w-3" />
            </a>
            <span v-else class="inline-flex items-center gap-1">
              <GitBranch class="h-4 w-4" />
              {{ currentBranch }}
            </span>
          </div>
          <Button
            v-if="canChangeBranch"
            size="sm"
            @click="isChangeBranchModalOpen = true"
            class="h-7 text-xs bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white"
          >
            Change Branch
          </Button>
        </dd>
      </div>

      <!-- Commit SHA -->
      <div v-if="currentCommitSha" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm/6 font-medium text-gray-900">Commit</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <a
            v-if="githubInfo?.repoUrl && currentCommitSha"
            :href="`${githubInfo.repoUrl}/commit/${currentCommitSha}`"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-900 hover:underline inline-flex items-center gap-1 font-mono text-xs"
          >
            <GitCommit class="h-4 w-4" />
            {{ currentShortSha }}
            <ExternalLink class="h-3 w-3" />
          </a>
          <span v-else class="inline-flex items-center gap-1 font-mono text-xs">
            <GitCommit class="h-4 w-4" />
            {{ currentShortSha }}
          </span>
        </dd>
      </div>
    </dl>

    <!-- Card Footer with Redeploy Button -->
    <template v-if="canRedeploy" #footer-actions>
      <Button
        size="sm"
        @click="isRedeployModalOpen = true"
        class="bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white"
      >
        <RefreshCw class="h-4 w-4 mr-2" />
        Redeploy
      </Button>
    </template>

    <!-- Change Branch Modal -->
    <ChangeBranchModal
      v-if="githubInfo && canChangeBranch"
      :open="isChangeBranchModalOpen"
      :team-id="installation.team_id"
      :server-id="installation.server!.id"
      :current-branch="currentBranch || 'main'"
      :owner="githubInfo.owner"
      :repo="githubInfo.repo"
      @update:open="isChangeBranchModalOpen = $event"
      @branch-changed="handleBranchChanged"
    />

    <!-- Redeploy Modal -->
    <RedeployModal
      v-if="githubInfo && canRedeploy"
      :open="isRedeployModalOpen"
      :team-id="installation.team_id"
      :server-id="installation.server!.id"
      :current-branch="currentBranch || 'main'"
      :current-commit-sha="currentCommitSha || ''"
      @update:open="isRedeployModalOpen = $event"
      @redeploy-complete="handleRedeployComplete"
    />
  </DsCard>
</template>
