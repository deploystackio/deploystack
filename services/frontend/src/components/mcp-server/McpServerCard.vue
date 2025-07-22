<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Info, Download } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import CategoryDisplay from '@/components/mcp-server/CategoryDisplay.vue'

const { t } = useI18n()

interface Props {
  server: {
    id: string
    name: string
    description?: string
    author_name?: string
    category_id?: string
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    [key: string]: any // Allow additional server properties
  }
  selectedServerId?: string | null
  showInstallButton?: boolean
  showDetailsButton?: boolean
  installButtonText?: string
  detailsButtonText?: string
  containerClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  selectedServerId: null,
  showInstallButton: true,
  showDetailsButton: true,
  installButtonText: '',
  detailsButtonText: '',
  containerClass: 'bg-muted/50 px-4 py-6 sm:rounded-lg sm:p-6 md:flex md:items-center md:justify-between md:space-x-6 lg:space-x-8'
})

const emit = defineEmits<{
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  install: [server: any]
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  details: [server: any]
}>()

// Computed properties
const isSelected = computed(() => {
  return props.selectedServerId === props.server.id
})

const finalInstallButtonText = computed(() => {
  return props.installButtonText || t('mcpInstallations.wizard.server.install')
})

const finalDetailsButtonText = computed(() => {
  return props.detailsButtonText || t('mcpInstallations.wizard.server.details')
})

// Event handlers
const handleInstallClick = () => {
  emit('install', props.server)
}

const handleDetailsClick = () => {
  emit('details', props.server)
}
</script>

<template>
  <div :class="containerClass">
    <!-- Server Information Grid -->
    <dl class="flex-auto divide-y divide-gray-200 text-sm text-gray-600 md:grid md:grid-cols-3 md:gap-x-6 md:divide-y-0 lg:w-1/2 lg:flex-none lg:gap-x-8">
      <!-- Server Name -->
      <div class="max-md:flex max-md:justify-between max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
        <dt class="font-medium text-gray-900">{{ t('mcpInstallations.wizard.server.name') }}</dt>
        <dd class="md:mt-1">{{ server.name }}</dd>
      </div>

      <!-- Author -->
      <div class="max-md:flex max-md:justify-between max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
        <dt class="font-medium text-gray-900">{{ t('mcpInstallations.wizard.server.author') }}</dt>
        <dd class="md:mt-1">{{ server.author_name || t('mcpInstallations.wizard.server.unknownAuthor') }}</dd>
      </div>

      <!-- Category -->
      <div class="max-md:flex max-md:justify-between max-md:py-4 max-md:first:pt-0 max-md:last:pb-0">
        <dt class="font-medium text-gray-900">{{ t('mcpInstallations.wizard.server.category') }}</dt>
        <dd class="md:mt-1">
          <CategoryDisplay
            :category-id="server.category_id"
            :show-not-provided="true"
            text-class="text-sm"
            icon-class="h-4 w-4 text-gray-600"
          />
        </dd>
      </div>
    </dl>

    <!-- Description (if provided) -->
    <div v-if="server.description" class="mt-4 md:mt-0 md:ml-6 lg:w-1/2">
      <p class="text-sm text-gray-600">{{ server.description }}</p>
    </div>

    <!-- Action Buttons -->
    <div class="mt-6 space-y-4 sm:flex sm:space-y-0 sm:space-x-4 md:mt-0">
      <!-- Details Button -->
      <Button
        v-if="showDetailsButton"
        variant="outline"
        @click="handleDetailsClick"
        class="flex w-full items-center justify-center border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-xs hover:bg-gray-50 md:w-auto"
      >
        <Info class="h-4 w-4 mr-2" />
        {{ finalDetailsButtonText }}
        <span class="sr-only">{{ server.name }}</span>
      </Button>

      <!-- Install Button -->
      <Button
        v-if="showInstallButton"
        @click="handleInstallClick"
        :variant="isSelected ? 'default' : 'outline'"
        :class="[
          'flex w-full items-center justify-center px-4 py-2 text-sm font-medium shadow-xs md:w-auto',
          isSelected
            ? 'border border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        ]"
      >
        <Download class="h-4 w-4 mr-2" />
        {{ finalInstallButtonText }}
        <span class="sr-only">{{ server.name }}</span>
      </Button>
    </div>
  </div>
</template>
