<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Shield, Package, Globe } from 'lucide-vue-next'

interface Props {
  requiresOauth?: boolean | null
  runtime: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packages?: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remotes?: any | null
}

defineProps<Props>()
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-sm font-semibold">Specifications</h3>

    <div class="space-y-3">
      <!-- Requires OAuth -->
      <div v-if="requiresOauth" class="space-y-1">
        <dt class="text-xs font-medium text-muted-foreground flex items-center gap-1">
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
      <div v-if="runtime !== 'http' && packages" class="space-y-1">
        <dt class="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Package class="h-3 w-3" />
          Packages
        </dt>
        <dd class="text-sm">
          <pre class="bg-muted border rounded p-3 text-xs overflow-x-auto">{{ JSON.stringify(packages, null, 2) }}</pre>
        </dd>
      </div>

      <!-- Remotes (if runtime === 'http') -->
      <div v-if="runtime === 'http' && remotes" class="space-y-1">
        <dt class="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Globe class="h-3 w-3" />
          Remotes
        </dt>
        <dd class="text-sm">
          <pre class="bg-muted border rounded p-3 text-xs overflow-x-auto">{{ JSON.stringify(remotes, null, 2) }}</pre>
        </dd>
      </div>
    </div>
  </div>
</template>
