<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Info } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/components/ui/empty'
import McpFeaturedList from './McpFeaturedList.vue'

const { t } = useI18n()
const router = useRouter()

const handleBrowseCatalog = () => {
  router.push('/mcp-server/search')
}
</script>

<template>
  <div class="flex flex-col lg:flex-row items-stretch justify-start gap-4 lg:gap-8 py-6 lg:py-10">
    <div class="flex flex-col items-stretch justify-start gap-5 flex-1 w-full">
      <Empty class="border border-solid">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Info class="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>
            {{ t('mcpInstallations.emptyState.title') }}
          </EmptyTitle>
          <EmptyDescription>
            {{ t('mcpInstallations.emptyState.description') }}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button @click="handleBrowseCatalog">
            {{ t('mcpInstallations.featuredList.browseCatalog') }}
          </Button>
        </EmptyContent>
      </Empty>
    </div>

    <div class="w-full lg:w-80 shrink-0">
      <McpFeaturedList />
    </div>
  </div>
</template>
