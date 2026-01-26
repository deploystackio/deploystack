<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from '@/components/ui/empty'
import { CheckCircle, AlertCircle } from 'lucide-vue-next'

interface Props {
  isLoading: boolean
  error: { error: string; step: string } | null
}

const props = defineProps<Props>()
const emit = defineEmits(['back', 'retry'])

const { t } = useI18n()

const hasError = computed(() => props.error !== null)
const isSuccess = computed(() => !props.isLoading && !hasError.value)
</script>

<template>
  <div class="space-y-6 py-8">
    <!-- Loading State -->
    <div v-if="isLoading" class="text-center">
      <Spinner class="h-16 w-16 mx-auto mb-6 text-primary" />
      <h2 class="text-xl font-semibold mb-2">{{ t('deployments.wizard.validating.title') }}</h2>
      <p class="text-muted-foreground mb-8">{{ t('deployments.wizard.validating.description') }}</p>

      <!-- Progress Boxes -->
      <div class="mt-8 space-y-2 text-left max-w-md mx-auto">
        <div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div class="animate-pulse h-2 w-2 bg-primary rounded-full" />
          <span class="text-sm">{{ t('deployments.wizard.validating.steps.connectingGithub') }}</span>
        </div>
        <div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div class="animate-pulse h-2 w-2 bg-primary rounded-full" />
          <span class="text-sm">{{ t('deployments.wizard.validating.steps.readingPackageJson') }}</span>
        </div>
        <div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div class="animate-pulse h-2 w-2 bg-primary rounded-full" />
          <span class="text-sm">{{ t('deployments.wizard.validating.steps.validatingMcpSdk') }}</span>
        </div>
        <div class="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div class="animate-pulse h-2 w-2 bg-primary rounded-full" />
          <span class="text-sm">{{ t('deployments.wizard.validating.steps.creatingInstallation') }}</span>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <Empty v-else-if="hasError">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle class="text-neutral-600" />
        </EmptyMedia>
        <EmptyTitle>{{ t('deployments.wizard.validating.error.title') }}</EmptyTitle>
        <EmptyDescription>
          <div class="text-sm text-muted-foreground max-w-md mx-auto">
            {{ error!.error }}
          </div>
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div class="flex justify-center gap-4">
          <Button
            @click="emit('back')"
            variant="outline"
          >
            {{ t('deployments.wizard.buttons.back') }}
          </Button>
          <Button
            @click="emit('retry')"
            variant="default"
          >
            {{ t('deployments.wizard.validating.error.tryAgain') }}
          </Button>
        </div>
      </EmptyContent>
    </Empty>

    <!-- Success State -->
    <div v-else-if="isSuccess" class="text-center">
      <CheckCircle class="h-16 w-16 text-green-600 mx-auto mb-4" />
      <h2 class="text-xl font-semibold text-green-600 mb-2">{{ t('deployments.wizard.validating.success.title') }}</h2>
      <p class="text-muted-foreground">{{ t('deployments.wizard.validating.success.description') }}</p>
    </div>
  </div>
</template>
