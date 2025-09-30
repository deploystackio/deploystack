<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Github, Star } from 'lucide-vue-next'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

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
  emit('install', props.server)

  router.push({
    path: '/mcp-server/add',
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

const getGitHubAvatarUrl = (server: McpServer) => {
  if (!server.github_account_id) return null
  return `https://avatars.githubusercontent.com/u/${server.github_account_id}?v=4&s=64`
}
</script>

<template>
  <div>
    <h2 class="sr-only">Server Details</h2>
    <div class="rounded-lg bg-gray-50 border-[6px] border-gray-200">
      <dl class="flex flex-wrap">
        <div class="flex-auto pt-6 pl-6">
          <dt
            class="text-sm/6 font-semibold text-gray-900 cursor-pointer hover:text-teal-700 transition-colors flex items-center gap-2"
            @click="handleServerClick"
            :title="`View ${server.name} details`"
          >
            <img
              v-if="getGitHubAvatarUrl(server)"
              :src="getGitHubAvatarUrl(server)!"
              :alt="`${server.name} GitHub avatar`"
              class="h-8 w-8 rounded-md flex-shrink-0"
              @error="($event.target as HTMLImageElement).style.display = 'none'"
            />
            {{ server.name }}
          </dt>
        </div>
        <div class="mt-6 flex w-full flex-none gap-x-4 items-center border-t border-gray-900/5 px-6 pt-6">
          <dt class="flex-none">
            <span class="sr-only">{{ t('mcpInstallations.view.fields.repository') }}</span>
            <Github class="h-4 w-4 text-gray-400" aria-hidden="true" />
          </dt>
          <dd class="text-sm/6 font-medium text-gray-900 min-w-0 flex-1">
            <a
              v-if="server.repository_url"
              :href="server.repository_url"
              target="_blank"
              rel="noopener noreferrer"
              class="hover:underline truncate block"
              :title="server.repository_url.replace('https://github.com/', '').replace('https://gitlab.com/', '').replace('https://bitbucket.org/', '')"
            >
              {{ server.repository_url.replace('https://github.com/', '').replace('https://gitlab.com/', '').replace('https://bitbucket.org/', '') }}
            </a>
            <span v-else class="text-gray-500 truncate block">{{ t('mcpInstallations.view.values.notProvided') }}</span>
          </dd>
          <dd v-if="server.github_stars !== null && server.github_stars !== undefined" class="flex items-center gap-1 text-sm/6 text-gray-600">
            <Star class="h-4 w-4 text-yellow-500 fill-yellow-500" aria-hidden="true" />
            <span>{{ server.github_stars.toLocaleString() }}</span>
          </dd>
        </div>
        <div class="mt-4 flex w-full flex-none gap-x-4 px-6">
          <dd class="text-sm text-gray-600 line-clamp-3 min-h-[3.75rem]">{{ getServerDescription(server) }}</dd>
        </div>
      </dl>
      <div class="mt-6 border-t border-gray-900/5 px-6 py-6">
        <Button
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
</style>
