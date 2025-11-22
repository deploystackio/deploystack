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
import { Globe, Github, Package, Code, User, Layers, Shield } from 'lucide-vue-next'
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

      <div v-if="server" class="pt-4 pb-4 space-y-6">
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
        <div class="space-y-4 pt-4 border-t border-gray-200">
          <h3 class="text-sm font-semibold text-gray-900">Specifications</h3>

          <!-- Requires OAuth -->
          <div v-if="server.requires_oauth" class="space-y-1">
            <dt class="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Shield class="h-3 w-3" />
              Authentication
            </dt>
            <dd class="text-sm">
              <Badge variant="default" class="text-xs">
                Requires OAuth
              </Badge>
            </dd>
          </div>

          <!-- Packages (if runtime !== 'http') -->
          <div v-if="server.runtime !== 'http' && server.packages" class="space-y-1">
            <dt class="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Package class="h-3 w-3" />
              Packages
            </dt>
            <dd class="text-sm">
              <pre class="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">{{ JSON.stringify(server.packages, null, 2) }}</pre>
            </dd>
          </div>

          <!-- Remotes (if runtime === 'http') -->
          <div v-if="server.runtime === 'http' && server.remotes" class="space-y-1">
            <dt class="text-xs font-medium text-gray-500 flex items-center gap-1">
              <Globe class="h-3 w-3" />
              Remotes
            </dt>
            <dd class="text-sm">
              <pre class="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">{{ JSON.stringify(server.remotes, null, 2) }}</pre>
            </dd>
          </div>
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
