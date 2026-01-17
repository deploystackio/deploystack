<script setup lang="ts">
import { Card } from '@/components/ui/card'
import { LogsNoAccess } from '@/components/mcp-server/installation'
import type { McpInstallation } from '@/types/mcp-installations'

interface Props {
  installation: McpInstallation
  teamId: string
  userTeamRole?: 'team_admin' | 'team_user' | null
}

defineProps<Props>()
</script>

<template>
  <div>
    <!-- No Access State for Non-Admin Users -->
    <LogsNoAccess v-if="userTeamRole !== 'team_admin'" />

    <!-- Logs Content for Admin Users -->
    <Card v-else class="rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 p-6">
      <div class="space-y-6">
        <!-- Title -->
        <div>
          <h3 class="text-lg font-semibold">Logs</h3>
          <p class="text-sm text-muted-foreground mt-1">
            View and analyze MCP server logs
          </p>
        </div>

        <!-- Lorem Ipsum Content -->
        <div class="space-y-4">
          <p class="text-neutral-800 dark:text-neutral-100">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </p>

          <p class="text-neutral-800 dark:text-neutral-100">
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          </p>

          <div class="border-l-4 border-neutral-300 dark:border-neutral-700 pl-4 py-2 bg-neutral-50 dark:bg-neutral-900">
            <p class="text-sm text-neutral-600 dark:text-neutral-400 italic">
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium,
              totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
            </p>
          </div>

          <p class="text-neutral-800 dark:text-neutral-100">
            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos
            qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur,
            adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div class="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <h4 class="font-medium text-neutral-800 dark:text-neutral-100 mb-2">Sample Log Entry</h4>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti.
              </p>
            </div>

            <div class="p-4 border border-neutral-200 dark:border-neutral-800 rounded-lg">
              <h4 class="font-medium text-neutral-800 dark:text-neutral-100 mb-2">Another Log Entry</h4>
              <p class="text-sm text-neutral-600 dark:text-neutral-400">
                Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio.
              </p>
            </div>
          </div>

          <p class="text-neutral-800 dark:text-neutral-100">
            Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates
            repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut
            reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.
          </p>
        </div>
      </div>
    </Card>
  </div>
</template>
