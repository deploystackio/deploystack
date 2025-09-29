<script setup lang="ts">
import { Github, ExternalLink } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

interface Props {
  githubUrl?: string | null
  homepageUrl?: string | null
}

defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-3">
    <h3 class="text-sm font-semibold">{{ t('mcpInstallations.view.fields.links') }}</h3>

    <ul class="space-y-2">
      <li v-if="githubUrl">
        <a
          :href="githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Github class="h-4 w-4" />
          <span>{{ t('mcpInstallations.view.values.repository') }}</span>
          <ExternalLink class="h-3 w-3 ml-auto" />
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
          <span>{{ t('mcpInstallations.view.values.homepage') }}</span>
          <ExternalLink class="h-3 w-3 ml-auto" />
        </a>
      </li>

      <li v-if="!githubUrl && !homepageUrl" class="text-sm text-muted-foreground">
        {{ t('mcpInstallations.view.values.noLinks') }}
      </li>
    </ul>
  </div>
</template>
