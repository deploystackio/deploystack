<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Github } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { GlobalSettingsService } from '@/services/globalSettingsService'

const { t } = useI18n()

// State
const isVisible = ref(false)
const isLoading = ref(true)

// Constants
const AWESOME_MCP_REPO_URL = 'https://github.com/deploystackio/awesome-mcp-server'

// Methods
const checkBannerVisibility = async () => {
  try {
    isLoading.value = true
    const shouldShow = await GlobalSettingsService.shouldShowMcpCatalogBanner()
    isVisible.value = shouldShow
  } catch (error) {
    console.error('Failed to check banner visibility:', error)
    isVisible.value = false // Default to hidden on error
  } finally {
    isLoading.value = false
  }
}

const handleContributeClick = () => {
  window.open(AWESOME_MCP_REPO_URL, '_blank', 'noopener,noreferrer')
}

// Lifecycle
onMounted(() => {
  checkBannerVisibility()
})
</script>

<template>
  <!-- Only render when not loading and visible -->
  <div v-if="!isLoading && isVisible" class="bg-white">
    <div class="mx-auto max-w-7xl py-12 sm:px-6 lg:px-8">
      <div class="relative isolate overflow-hidden bg-linear-to-r from-emerald-600 to-emerald-950 px-6 pt-8 pb-8 sm:rounded-3xl sm:px-8 lg:flex lg:gap-x-20">
        <div class="mx-auto max-w-full text-left lg:mx-0 lg:flex-auto lg:flex lg:items-center lg:justify-between">
          <div class="flex-1 lg:max-w-[70%]">
            <p class="text-lg/8 text-pretty text-gray-300">
              {{ t('mcpInstallations.wizard.server.contributionBanner.missingServer') }}<br>
              {{ t('mcpInstallations.wizard.server.contributionBanner.addToCatalog') }}
              <a
                :href="AWESOME_MCP_REPO_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="font-semibold text-white underline hover:text-gray-100"
              >
                {{ t('mcpInstallations.wizard.server.contributionBanner.awesomeRepo') }}
              </a>
            </p>
          </div>
          <div class="lg:flex-shrink-0">
            <Button
              @click="handleContributeClick"
              class="mt-4 lg:mt-0 lg:ml-6 rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-gray-900 shadow-xs hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Github class="h-4 w-4 mr-2" />
              awesome-mcp-server
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
