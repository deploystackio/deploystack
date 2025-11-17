<script setup lang="ts">
import type { LinkAction } from '@/services/satelliteConfigService'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-vue-next'

interface Props {
  action: LinkAction
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: [action: LinkAction]
}>()

function handleClick() {
  emit('click', props.action)
}
</script>

<template>
  <div>
    <!-- Image button if imageUrl exists -->
    <a
      v-if="action.imageUrl"
      :href="action.url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-block"
      @click.prevent="handleClick"
    >
      <img
        :src="action.imageUrl"
        :alt="action.buttonText || action.name || 'Install'"
        class="h-8 cursor-pointer hover:opacity-80 transition-opacity"
      />
    </a>
    <!-- Text button if no imageUrl -->
    <Button
      v-else
      @click="handleClick"
      variant="outline"
      class="flex items-center gap-2"
    >
      <ExternalLink class="h-4 w-4" />
      {{ action.buttonText || action.name || 'Install' }}
    </Button>
  </div>
</template>
