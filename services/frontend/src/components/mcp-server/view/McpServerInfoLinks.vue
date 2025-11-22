<script setup lang="ts">
import { Github, ExternalLink } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

interface Props {
  repositoryUrl?: string | null
  homepageUrl?: string | null
}

defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-sm font-semibold">Links</h3>

    <ul class="space-y-2">
      <li v-if="repositoryUrl">
        <a
          :href="repositoryUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Github class="h-4 w-4" />
          <span>{{ t('mcpInstallations.view.values.repository') }}</span>
        </a>
      </li>

      <li v-if="homepageUrl">
        <a
          :href="homepageUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink class="h-4 w-4" />
          <span>{{ homepageUrl.replace('https://', '').replace('http://', '') }}</span>
        </a>
      </li>

      <li v-if="!repositoryUrl && !homepageUrl" class="text-sm text-muted-foreground">
        {{ t('mcpInstallations.view.values.noLinks') }}
      </li>
    </ul>
  </div>
</template>
