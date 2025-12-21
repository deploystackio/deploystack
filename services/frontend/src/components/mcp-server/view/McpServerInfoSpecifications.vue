<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { CodeHighlight } from '@/components/ui/code-highlight'
import { Shield, Package, Globe } from 'lucide-vue-next'

interface Props {
  requiresOauth?: boolean | null
  runtime: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  packages?: any | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  remotes?: any | null
  showHeading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showHeading: true
})

// Format JSON for display
const formattedPackages = computed(() => {
  if (!props.packages) return ''
  return JSON.stringify(props.packages, null, 2)
})

const formattedRemotes = computed(() => {
  if (!props.remotes) return ''
  return JSON.stringify(props.remotes, null, 2)
})
</script>

<template>
  <div class="space-y-3">
    <h3 v-if="showHeading" class="text-sm font-semibold">Specifications</h3>

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
          <CodeHighlight :code="formattedPackages" language="json" />
        </dd>
      </div>

      <!-- Remotes (if runtime === 'http') -->
      <div v-if="runtime === 'http' && remotes" class="space-y-1">
        <dt class="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Globe class="h-3 w-3" />
          Remotes
        </dt>
        <dd class="text-sm">
          <CodeHighlight :code="formattedRemotes" language="json" />
        </dd>
      </div>
    </div>
  </div>
</template>
