<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Spinner } from '@/components/ui/spinner'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { AlertCircle } from 'lucide-vue-next'

interface Props {
  isLoading: boolean
  error: { error: string; step: string } | null
  metadata?: {
    name?: string
    version?: string
    description?: string
    runtime: 'node' | 'python' | 'go' | 'unknown'
    mcp_sdk: {
      detected: boolean
      version?: string
      package: string
      runtime: 'node' | 'python' | 'go' | 'unknown'
    }
    scripts?: {
      build?: string
      start?: string
      [key: string]: string | undefined
    }
  } | null
}

const props = defineProps<Props>()

const { t } = useI18n()

const hasError = computed(() => props.error !== null)
const isSuccess = computed(() => !props.isLoading && !hasError.value)

function getRuntimeLabel(runtime: string) {
  switch (runtime) {
    case 'node': return 'Node.js'
    case 'python': return 'Python'
    case 'go': return 'Go'
    default: return 'Unknown'
  }
}
</script>

<template>
  <div>
    <div class="space-y-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="text-center">
      <Spinner class="h-16 w-16 mx-auto mb-6 text-primary" />
      <p class="text-muted-foreground mb-8">{{ t('deployments.wizard.validating.description') }}</p>

      <!-- Progress Boxes -->
      <div class="mt-8 space-y-2 text-left max-w-md mx-auto">
        <div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div class="animate-pulse h-2 w-2 bg-primary rounded-full" />
          <span class="text-sm">{{ t('deployments.wizard.validating.steps.connectingGithub') }}</span>
        </div>
        <div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div class="animate-pulse h-2 w-2 bg-primary rounded-full" />
          <span class="text-sm">{{ t('deployments.wizard.validating.steps.readingPackageJson') }}</span>
        </div>
        <div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div class="animate-pulse h-2 w-2 bg-primary rounded-full" />
          <span class="text-sm">{{ t('deployments.wizard.validating.steps.validatingMcpSdk') }}</span>
        </div>
        <div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div class="animate-pulse h-2 w-2 bg-primary rounded-full" />
          <span class="text-sm">{{ t('deployments.wizard.validating.steps.creatingInstallation') }}</span>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="hasError">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircle class="text-neutral-600" />
          </EmptyMedia>
          <EmptyTitle>{{ t('deployments.wizard.validating.error.title') }}</EmptyTitle>
          <EmptyDescription>
            <div class="text-sm text-muted-foreground max-w-md mx-auto">
              {{ error!.error }}
            </div>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>

    <!-- Success State with Tailwind UI List -->
    <div v-else-if="isSuccess">
      <!-- Validation Items List -->
      <div v-if="metadata">
        <ul role="list" class="divide-y divide-gray-100">
          <!-- Overall Status (First Item) -->
          <li class="relative flex items-center space-x-4 py-4">
            <div class="flex-none rounded-full bg-green-100 p-1 text-green-500">
              <div class="size-2 rounded-full bg-current"></div>
            </div>
            <div class="min-w-0 flex-auto">
              <div class="flex items-center gap-x-3">
                <h2 class="min-w-0 text-sm/6 font-semibold text-gray-900">
                  {{ t('deployments.wizard.validating.success.overallStatus') }}
                </h2>
              </div>
            </div>
            <div class="flex-none rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-700/10">
              {{ t('deployments.wizard.validating.success.statusSuccess') }}
            </div>
          </li>

          <!-- Package Name -->
          <li v-if="metadata.name" class="relative flex items-center space-x-4 py-4">
            <div class="flex-none rounded-full bg-green-100 p-1 text-green-500">
              <div class="size-2 rounded-full bg-current"></div>
            </div>
            <div class="min-w-0 flex-auto">
              <div class="flex items-center gap-x-3">
                <h2 class="min-w-0 text-sm/6 font-semibold text-gray-900">
                  {{ t('deployments.wizard.validating.success.packageName') }}
                </h2>
              </div>
              <div class="mt-1 flex items-center gap-x-2.5 text-xs/5 text-gray-500">
                <p class="truncate font-mono">{{ metadata.name }}</p>
              </div>
            </div>
          </li>

          <!-- Version -->
          <li v-if="metadata.version" class="relative flex items-center space-x-4 py-4">
            <div class="flex-none rounded-full bg-green-100 p-1 text-green-500">
              <div class="size-2 rounded-full bg-current"></div>
            </div>
            <div class="min-w-0 flex-auto">
              <div class="flex items-center gap-x-3">
                <h2 class="min-w-0 text-sm/6 font-semibold text-gray-900">
                  {{ t('deployments.wizard.validating.success.version') }}
                </h2>
              </div>
              <div class="mt-1 flex items-center gap-x-2.5 text-xs/5 text-gray-500">
                <p class="truncate font-mono">{{ metadata.version }}</p>
              </div>
            </div>
          </li>

          <!-- Runtime -->
          <li class="relative flex items-center space-x-4 py-4">
            <div class="flex-none rounded-full bg-green-100 p-1 text-green-500">
              <div class="size-2 rounded-full bg-current"></div>
            </div>
            <div class="min-w-0 flex-auto">
              <div class="flex items-center gap-x-3">
                <h2 class="min-w-0 text-sm/6 font-semibold text-gray-900">
                  {{ t('deployments.wizard.validating.success.runtime') }}
                </h2>
              </div>
              <div class="mt-1 flex items-center gap-x-2.5 text-xs/5 text-gray-500">
                <p class="truncate">{{ getRuntimeLabel(metadata.runtime) }}</p>
              </div>
            </div>
          </li>

          <!-- MCP SDK -->
          <li class="relative flex items-center space-x-4 py-4">
            <div class="flex-none rounded-full bg-green-100 p-1 text-green-500">
              <div class="size-2 rounded-full bg-current"></div>
            </div>
            <div class="min-w-0 flex-auto">
              <div class="flex items-center gap-x-3">
                <h2 class="min-w-0 text-sm/6 font-semibold text-gray-900">
                  {{ t('deployments.wizard.validating.success.mcpSdk') }}
                </h2>
              </div>
              <div class="mt-1 flex items-center gap-x-2.5 text-xs/5 text-gray-500">
                <p class="truncate">{{ metadata.mcp_sdk.package }} {{ metadata.mcp_sdk.version }}</p>
              </div>
            </div>
          </li>

          <!-- Build Script -->
          <li v-if="metadata.scripts?.build" class="relative flex items-center space-x-4 py-4">
            <div class="flex-none rounded-full bg-green-100 p-1 text-green-500">
              <div class="size-2 rounded-full bg-current"></div>
            </div>
            <div class="min-w-0 flex-auto">
              <div class="flex items-center gap-x-3">
                <h2 class="min-w-0 text-sm/6 font-semibold text-gray-900">
                  {{ t('deployments.wizard.validating.success.buildScript') }}
                </h2>
              </div>
              <div class="mt-1 flex items-center gap-x-2.5 text-xs/5 text-gray-500">
                <p class="truncate font-mono">{{ metadata.scripts.build }}</p>
              </div>
            </div>
          </li>

          <!-- Start Script -->
          <li v-if="metadata.scripts?.start" class="relative flex items-center space-x-4 py-4">
            <div class="flex-none rounded-full bg-green-100 p-1 text-green-500">
              <div class="size-2 rounded-full bg-current"></div>
            </div>
            <div class="min-w-0 flex-auto">
              <div class="flex items-center gap-x-3">
                <h2 class="min-w-0 text-sm/6 font-semibold text-gray-900">
                  {{ t('deployments.wizard.validating.success.startScript') }}
                </h2>
              </div>
              <div class="mt-1 flex items-center gap-x-2.5 text-xs/5 text-gray-500">
                <p class="truncate font-mono">{{ metadata.scripts.start }}</p>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
    </div>
  </div>
</template>
