<script setup lang="ts">
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Globe, Github, Code, User, Layers } from 'lucide-vue-next'
import McpServerInfoSpecifications from '@/components/mcp-server/view/McpServerInfoSpecifications.vue'
import type { McpServer } from '@/views/admin/mcp-server-catalog/types'

interface Props {
  server: McpServer | null
}

defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Server Details</SheetTitle>
      </SheetHeader>

      <div v-if="server" class="px-4 pt-4 pb-4 space-y-6">
        <!-- Basic Information Section -->
        <div class="space-y-4">

          <!-- Description -->
          <div class="space-y-1">
            <dt class="text-xs font-medium text-gray-500">Description</dt>
            <dd class="text-sm text-gray-900">
              {{ server.description || 'No description available' }}
            </dd>
          </div>

          <!-- Website URL -->
          <div v-if="server.website_url" class="space-y-1">
            <dt class="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Globe class="h-3 w-3" />
              Website
            </dt>
            <dd class="text-sm">
              <a
                :href="server.website_url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:underline"
              >
                {{ server.website_url }}
              </a>
            </dd>
          </div>

          <!-- GitHub URL -->
          <div v-if="server.repository_url" class="space-y-1">
            <dt class="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Github class="h-3 w-3" />
              Repository
            </dt>
            <dd class="text-sm">
              <a
                :href="server.repository_url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:underline"
              >
                {{ server.repository_url }}
              </a>
            </dd>
          </div>

          <!-- Runtime -->
          <div class="space-y-1">
            <dt class="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Layers class="h-3 w-3" />
              Runtime
            </dt>
            <dd class="text-sm">
              <Badge variant="secondary" class="font-mono text-xs">
                {{ server.runtime }}
              </Badge>
            </dd>
          </div>

          <!-- Language -->
          <div v-if="server.language && server.language.toLowerCase() !== 'http'" class="space-y-1">
            <dt class="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Code class="h-3 w-3" />
              Language
            </dt>
            <dd class="text-sm">
              <Badge variant="outline" class="text-xs">
                {{ server.language }}
              </Badge>
            </dd>
          </div>

          <!-- Author Name -->
          <div v-if="server.author_name" class="space-y-1">
            <dt class="text-xs font-medium text-gray-500 flex items-center gap-1">
              <User class="h-3 w-3" />
              Author
            </dt>
            <dd class="text-sm text-gray-900">
              {{ server.author_name }}
            </dd>
          </div>

          <!-- Transport Type -->
          <div class="space-y-1">
            <dt class="text-xs font-medium text-gray-500">Transport Type</dt>
            <dd class="text-sm">
              <Badge variant="outline" class="text-xs uppercase">
                {{ server.transport_type }}
              </Badge>
            </dd>
          </div>
        </div>

        <!-- Specifications Section -->
        <div v-if="server.requires_oauth || (server.runtime !== 'http' && server.packages) || (server.runtime === 'http' && server.remotes)" class="pt-4 border-t border-gray-200">
          <McpServerInfoSpecifications
            :requires-oauth="server.requires_oauth"
            :runtime="server.runtime"
            :packages="server.packages"
            :remotes="server.remotes"

            :template-args="server.template_args"
            :template-env="server.template_env"
            :template-headers="server.template_headers"
            :template-url-query-params="server.template_url_query_params"

            :team-args-schema="server.team_args_schema"
            :team-env-schema="server.team_env_schema"
            :team-headers-schema="server.team_headers_schema"
            :team-url-query-params-schema="server.team_url_query_params_schema"

            :user-args-schema="server.user_args_schema"
            :user-env-schema="server.user_env_schema"
            :user-headers-schema="server.user_headers_schema"
            :user-url-query-params-schema="server.user_url_query_params_schema"
          />
        </div>
      </div>

      <SheetFooter>
        <Button @click="open = false" variant="outline" class="w-full">
          Close
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
