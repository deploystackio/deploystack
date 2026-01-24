<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { GitBranch, GitCommit, Calendar } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'

interface DeployedServer {
  id: string
  name: string
  repository_url: string
  git_branch: string
  git_commit_sha: string
  installation_id: string
  created_at: string
  status?: string
}

const props = defineProps<{
  deployment: DeployedServer
}>()

const emit = defineEmits<{
  click: [installationId: string]
}>()

const { t } = useI18n()

const shortCommit = computed(() => {
  return props.deployment.git_commit_sha?.substring(0, 7) || 'unknown'
})

const repoName = computed(() => {
  const url = props.deployment.repository_url
  const match = url.match(/github\.com[/:]([\w-]+\/[\w-]+)/)
  return match?.[1]?.replace('.git', '') ?? url
})

const deployedDate = computed(() => {
  return new Date(props.deployment.created_at).toLocaleDateString()
})

const statusVariant = computed(() => {
  const status = props.deployment.status
  if (status === 'online') return 'default'
  if (status === 'provisioning') return 'secondary'
  return 'outline'
})

function handleClick() {
  emit('click', props.deployment.installation_id)
}
</script>

<template>
  <div
    @click="handleClick"
    class="border rounded-lg p-6 cursor-pointer transition hover:border-primary hover:shadow-md bg-card"
  >
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold text-lg truncate">{{ deployment.name }}</h3>
        </div>
        <Badge v-if="deployment.status" :variant="statusVariant">
          {{ t(`deployments.card.status.${deployment.status}`) }}
        </Badge>
      </div>

      <!-- Repository Info -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <!-- Repository -->
        <div class="flex items-center gap-2 text-muted-foreground">
          <GitBranch class="h-4 w-4 flex-shrink-0" />
          <span class="truncate font-mono">{{ repoName }}</span>
        </div>

        <!-- Branch -->
        <div class="flex items-center gap-2 text-muted-foreground">
          <GitBranch class="h-4 w-4 flex-shrink-0" />
          <span class="truncate font-mono">{{ deployment.git_branch }}</span>
        </div>

        <!-- Commit -->
        <div class="flex items-center gap-2 text-muted-foreground">
          <GitCommit class="h-4 w-4 flex-shrink-0" />
          <span class="font-mono">{{ shortCommit }}</span>
        </div>
      </div>

      <!-- Deployment Date -->
      <div class="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
        <Calendar class="h-4 w-4" />
        <span>{{ t('deployments.card.deployedAt') }}: {{ deployedDate }}</span>
      </div>
    </div>
  </div>
</template>
