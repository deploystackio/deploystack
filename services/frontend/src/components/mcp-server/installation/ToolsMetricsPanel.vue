<script setup lang="ts">
interface Props {
  toolCount: number
  totalTokens: number
  enabledCount: number
  disabledCount: number
}

defineProps<Props>()

// Format token count with commas
const formatTokenCount = (count: number) => {
  return count.toLocaleString()
}
</script>

<template>
  <div class="border rounded-lg p-6">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8">
      <!-- Total Tools Metric -->
      <div class="flex flex-col gap-1">
        <span class="text-sm text-muted-foreground font-medium">
          Total Tools
        </span>
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-normal">
            {{ toolCount }}
          </span>
        </div>
      </div>

      <!-- Enabled Tools Metric -->
      <div class="flex flex-col gap-1 border-l pl-8">
        <span class="text-sm text-muted-foreground font-medium">
          Enabled Tools
        </span>
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-normal">
            {{ enabledCount }} / {{ toolCount }}
          </span>
        </div>
      </div>

      <!-- Disabled Tools Metric -->
      <div class="flex flex-col gap-1 border-l pl-8">
        <span class="text-sm text-muted-foreground font-medium">
          Disabled Tools
        </span>
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-normal">
            {{ disabledCount }} / {{ toolCount }}
          </span>
        </div>
      </div>

      <!-- Total Tokens Metric -->
      <div class="flex flex-col gap-1 border-l pl-8">
        <span class="text-sm text-muted-foreground font-medium">
          Total Tokens
        </span>
        <div class="flex items-baseline gap-1">
          <span class="text-xl font-normal">
            {{ formatTokenCount(totalTokens) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
