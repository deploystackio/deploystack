<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { Github, Star, Globe } from 'lucide-vue-next'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'
import McpServerAvatar from './McpServerAvatar.vue'

interface Props {
  server: McpServer
}

const props = defineProps<Props>()

const emit = defineEmits<{
  install: [server: McpServer]
  click: [server: McpServer]
}>()

const { t } = useI18n()
const router = useRouter()

const handleInstall = () => {
  // Prevent installation for Python servers
  if (isPythonServer(props.server.runtime)) {
    return
  }

  emit('install', props.server)

  router.push({
    path: '/mcp-server/install',
    query: {
      serverId: props.server.id,
      step: '2'
    }
  })
}

const handleServerClick = () => {
  emit('click', props.server)
  router.push(`/mcp-server/view/${props.server.id}`)
}

const getServerDescription = (server: McpServer) => {
  return server.description || 'No description available'
}

const getRuntimeBadgeClass = (runtime: string | null | undefined) => {
  if (!runtime) return 'bg-gray-100 text-gray-800'
  
  const runtimeLower = runtime.toLowerCase()
  
  if (runtimeLower === 'node') {
    return 'bg-green-100 text-green-800'
  } else if (runtimeLower === 'python') {
    return 'bg-blue-100 text-blue-800'
  } else if (runtimeLower === 'http') {
    return 'bg-purple-100 text-purple-800'
  }
  
  return 'bg-gray-100 text-gray-800'
}

const isPythonServer = (runtime: string | null | undefined) => {
  if (!runtime) return false
  return runtime.toLowerCase() === 'python'
}

const truncateServerName = (name: string, maxLength: number = 30) => {
  if (name.length <= maxLength) return name
  return name.substring(0, maxLength) + '...'
}
</script>

<template>
  <div>
    <h2 class="sr-only">Server Details</h2>
    <div class="rounded-lg bg-white border-[6px] border-gray-200">
      <dl class="flex flex-wrap">
        <div class="flex-auto pt-6 pl-6">
          <dt
            class="text-sm/6 font-semibold text-gray-900 cursor-pointer hover:text-teal-700 transition-colors flex items-center gap-2 truncate"
            @click="handleServerClick"
            :title="`View ${server.name} details`"
          >
            <McpServerAvatar
              :icon-url="server.icon_url"
              :server-name="server.name"
              size="sm"
              rounded="md"
            />
            <span class="truncate">{{ truncateServerName(server.name) }}</span>
          </dt>
        </div>
        <div class="flex-none pt-6 pr-6">
          <Badge v-if="server.runtime" variant="secondary" :class="['font-mono text-xs', getRuntimeBadgeClass(server.runtime)]">
            {{ server.runtime }}
          </Badge>
        </div>
        <!-- URL Section - always show border for consistent height -->
        <div class="mt-6 flex w-full flex-none gap-x-4 items-center border-t border-gray-900/5 px-6 pt-6 min-h-[3.5rem]">
          <!-- Show repository URL if available -->
          <template v-if="server.repository_url">
            <dt class="flex-none">
              <span class="sr-only">{{ t('mcpInstallations.view.fields.repository') }}</span>
              <Github class="h-4 w-4 text-gray-400" aria-hidden="true" />
            </dt>
            <dd class="text-sm/6 font-medium text-gray-900 min-w-0 flex-1">
              <a
                :href="server.repository_url"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:underline truncate block"
                :title="server.repository_url.replace('https://github.com/', '').replace('https://gitlab.com/', '').replace('https://bitbucket.org/', '')"
              >
                {{ server.repository_url.replace('https://github.com/', '').replace('https://gitlab.com/', '').replace('https://bitbucket.org/', '') }}
              </a>
            </dd>
            <dd v-if="server.github_stars !== null && server.github_stars !== undefined" class="flex items-center gap-1 text-sm/6 text-gray-600">
              <Star class="h-4 w-4 text-yellow-500 fill-yellow-500" aria-hidden="true" />
              <span>{{ server.github_stars.toLocaleString() }}</span>
            </dd>
          </template>
          <!-- Show website URL if no repository URL but website URL is available -->
          <template v-else-if="server.website_url">
            <dt class="flex-none">
              <span class="sr-only">Website</span>
              <Globe class="h-4 w-4 text-gray-400" aria-hidden="true" />
            </dt>
            <dd class="text-sm/6 font-medium text-gray-900 min-w-0 flex-1">
              <a
                :href="server.website_url"
                target="_blank"
                rel="noopener noreferrer"
                class="hover:underline truncate block"
                :title="server.website_url"
              >
                {{ server.website_url.replace('https://', '').replace('http://', '') }}
              </a>
            </dd>
          </template>
          <!-- Empty placeholder when no URL is available -->
          <template v-else>
            <dd class="text-sm/6 text-gray-400 italic">No repository or website</dd>
          </template>
        </div>
        <div class="mt-4 flex w-full flex-none gap-x-4 px-6">
          <dd class="text-sm text-gray-600 line-clamp-3 min-h-[3.75rem]">
            {{ getServerDescription(server) }}
          </dd>
        </div>
        <div v-if="server.tags && server.tags.length > 0" class="mt-2 flex w-full flex-none px-6 min-h-[3rem]">
          <dd class="flex flex-wrap gap-1.5 items-center line-clamp-2">
            <Badge
              v-for="tag in server.tags"
              :key="tag"
              variant="outline"
              class="text-xs px-2 py-0.5"
            >
              {{ tag }}
            </Badge>
          </dd>
        </div>
        <div v-else class="mt-2 flex w-full flex-none px-6 min-h-[3rem]">
          <!-- Empty space to maintain consistent card height -->
        </div>
      </dl>
      <div class="mt-6 border-t border-gray-900/5 px-6 py-6">
        <HoverCard v-if="isPythonServer(server.runtime)" :open-delay="0">
          <HoverCardTrigger as-child>
            <Button
              variant="outline"
              class="w-full flex items-center justify-center gap-2 bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white text-sm font-semibold"
            >
              {{ t('mcpInstallations.actions.install') }} <span aria-hidden="true">&rarr;</span>
            </Button>
          </HoverCardTrigger>
          <HoverCardContent class="w-80">
            <div class="text-sm">
              <p class="font-semibold text-gray-900">Python MCP servers not supported yet</p>
              <p class="text-gray-600 mt-1">We're working on adding Python runtime support. Stay tuned!</p>
            </div>
          </HoverCardContent>
        </HoverCard>
        <Button
          v-else
          @click="handleInstall"
          variant="outline"
          class="w-full flex items-center justify-center gap-2 bg-black text-white border-black hover:bg-black/90 hover:border-black hover:text-white text-sm font-semibold"
        >
          {{ t('mcpInstallations.actions.install') }} <span aria-hidden="true">&rarr;</span>
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
