<script setup lang="ts">
import { computed } from 'vue'
import { DsCard } from '@/components/ui/ds-card'
import { ExternalLink, GitBranch, GitCommit } from 'lucide-vue-next'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
}

const props = defineProps<Props>()

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

// Compute hierarchical router tool path prefix
const routerPath = computed(() => {
  if (!props.installation?.team_slug || !props.installation?.server?.slug) {
    return null
  }
  return `${props.installation.team_slug}-${props.installation.server.slug}:*`
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
      <div v-if="githubInfo.branch" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm/6 font-medium text-gray-900">Branch</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <a
            v-if="githubInfo.branchUrl"
            :href="githubInfo.branchUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-900 hover:underline inline-flex items-center gap-1"
          >
            <GitBranch class="h-4 w-4" />
            {{ githubInfo.branch }}
            <ExternalLink class="h-3 w-3" />
          </a>
          <span v-else class="inline-flex items-center gap-1">
            <GitBranch class="h-4 w-4" />
            {{ githubInfo.branch }}
          </span>
        </dd>
      </div>

      <!-- Commit SHA -->
      <div v-if="githubInfo.commitSha" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm/6 font-medium text-gray-900">Commit</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <a
            v-if="githubInfo.commitUrl"
            :href="githubInfo.commitUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-900 hover:underline inline-flex items-center gap-1 font-mono text-xs"
          >
            <GitCommit class="h-4 w-4" />
            {{ githubInfo.shortSha }}
            <ExternalLink class="h-3 w-3" />
          </a>
          <span v-else class="inline-flex items-center gap-1 font-mono text-xs">
            <GitCommit class="h-4 w-4" />
            {{ githubInfo.shortSha }}
          </span>
        </dd>
      </div>

      <!-- Hierarchical Router Path -->
      <div v-if="routerPath" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
        <dt class="text-sm/6 font-medium text-gray-900">Hierarchical Router Path</dt>
        <dd class="mt-1 text-sm/6 text-gray-700 sm:col-span-2 sm:mt-0">
          <code class="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{{ routerPath }}</code>
        </dd>
      </div>
    </dl>
  </DsCard>
</template>
