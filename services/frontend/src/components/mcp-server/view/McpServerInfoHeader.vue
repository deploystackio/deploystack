<script setup lang="ts">
import { computed } from 'vue'
import { Star } from 'lucide-vue-next'

interface Props {
  name: string
  authorName?: string | null
  organization?: string | null
  githubStars?: number | null
  githubAccountId?: string | null
  description?: string | null
}

const props = defineProps<Props>()

const avatarUrl = computed(() => {
  if (!props.githubAccountId) return null
  return `https://avatars.githubusercontent.com/u/${props.githubAccountId}?v=4&s=128`
})

const displayAuthor = computed(() => {
  return props.organization || props.authorName || 'Unknown'
})

const formattedStars = computed(() => {
  if (!props.githubStars) return '0'
  if (props.githubStars >= 1000) {
    return `${(props.githubStars / 1000).toFixed(1)}k`
  }
  return props.githubStars.toString()
})
</script>

<template>
  <div class="space-y-3">
    <div v-if="avatarUrl" class="flex justify-center">
      <img
        :src="avatarUrl"
        :alt="`${name} logo`"
        class="h-20 w-20 rounded-lg"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
    </div>

    <div class="text-center space-y-1">
      <h2 class="text-lg font-semibold">{{ name }}</h2>
      <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <span>By <span class="font-medium text-foreground">{{ displayAuthor }}</span></span>
        <span>·</span>
        <div class="flex items-center gap-1">
          <Star class="h-4 w-4" />
          <span>{{ formattedStars }}</span>
        </div>
      </div>
    </div>

    <p v-if="description" class="text-sm text-muted-foreground text-center">
      {{ description }}
    </p>
  </div>
</template>
