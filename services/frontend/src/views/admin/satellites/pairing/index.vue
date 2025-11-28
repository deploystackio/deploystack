<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import TokenTable from '@/components/admin/satellites/TokenTable.vue'
import CreateTokenModal from '@/components/admin/satellites/CreateTokenModal.vue'
import { SatelliteTokenService, type RegistrationToken } from '@/services/satelliteTokenService'

const { t } = useI18n()
const { setBreadcrumbs } = useBreadcrumbs()

// State
const tokens = ref<RegistrationToken[]>([])
const isLoading = ref(true)
const error = ref<string | null>(null)
const isCreateModalOpen = ref(false)

// Fetch tokens from API
const fetchTokens = async (): Promise<void> => {
  try {
    isLoading.value = true
    error.value = null

    const response = await SatelliteTokenService.listTokens()

    if (response.success) {
      tokens.value = response.data.tokens
    } else {
      throw new Error('Failed to fetch registration tokens')
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred'
    error.value = errorMessage
    tokens.value = []

    // Show error toast for fetch failures
    toast.error(t('satellites.pairing.toasts.fetchError.title'), {
      description: errorMessage
    })
  } finally {
    isLoading.value = false
  }
}

// Handle token creation
const handleTokenCreated = (newToken: RegistrationToken) => {
  tokens.value.unshift(newToken) // Add to beginning of list
  isCreateModalOpen.value = false

  toast.success(t('satellites.pairing.toasts.tokenCreated.title'), {
    description: t('satellites.pairing.toasts.tokenCreated.description')
  })
}

// Handle token revocation
const handleTokenRevoked = async (tokenId: string) => {
  try {
    const response = await SatelliteTokenService.revokeToken(tokenId)

    if (response.success) {
      // Remove from local state
      tokens.value = tokens.value.filter(token => token.id !== tokenId)

      toast.success(t('satellites.pairing.toasts.tokenRevoked.title'), {
        description: t('satellites.pairing.toasts.tokenRevoked.description')
      })
    } else {
      throw new Error('Failed to revoke token')
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to revoke token'
    toast.error(t('satellites.pairing.toasts.revokeError.title'), {
      description: errorMessage
    })
  }
}

// Load data on component mount
onMounted(async () => {
  setBreadcrumbs([
    { label: t('satellites.title'), href: '/admin/satellites' },
    { label: t('satellites.pairing.title') }
  ])
  await fetchTokens()
})
</script>

<template>
  <DashboardLayout>
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex justify-end">
        <Button
          @click="isCreateModalOpen = true"
          variant="default"
          class="flex items-center gap-2"
        >
          <Plus class="h-4 w-4" />
          {{ t('satellites.actions.createToken') }}
        </Button>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="text-muted-foreground">
        {{ t('satellites.pairing.loading') }}
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-red-500">
        {{ t('satellites.pairing.error', { error }) }}
      </div>

      <!-- Token Table -->
      <div v-else>
        <TokenTable
          :tokens="tokens"
          @token-revoked="handleTokenRevoked"
        />
      </div>

      <!-- Create Token Modal -->
      <CreateTokenModal
        v-model:open="isCreateModalOpen"
        @token-created="handleTokenCreated"
      />
    </div>
  </DashboardLayout>
</template>
