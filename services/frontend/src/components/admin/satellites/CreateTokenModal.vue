<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, Clock, AlertCircle } from 'lucide-vue-next'
import { SatelliteTokenService, type RegistrationToken, type CreateTokenRequest } from '@/services/satelliteTokenService'

interface Props {
  open: boolean
}

interface Emits {
  (e: 'update:open', open: boolean): void
  (e: 'token-created', token: RegistrationToken): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { t } = useI18n()

// State
const isCreating = ref(false)
const createdToken = ref<RegistrationToken | null>(null)
const step = ref<'config' | 'result'>('config')
const displayToken = ref('')

// Form state
const tokenType = ref<'global' | 'team'>('global')
const expiresInHours = ref(1)
const teamId = ref<string>('')

// Mock user permissions - in real app, get from auth store
const userRole = ref('global_admin') // or 'team_admin'
const userTeams = ref([
  { id: '1', name: 'Frontend Team', slug: 'frontend' },
  { id: '2', name: 'Backend Team', slug: 'backend' }
])

// Computed properties
const canCreateGlobal = computed(() => userRole.value === 'global_admin')
const canCreateTeam = computed(() => userRole.value === 'team_admin' || userRole.value === 'global_admin')

const maxHours = computed(() => {
  return tokenType.value === 'global' ? 8 : 72
})

const recommendedHours = computed(() => {
  return tokenType.value === 'global' ? 1 : 24
})

// Reset form state
const resetForm = () => {
  tokenType.value = 'global'
  expiresInHours.value = 1
  teamId.value = ''
  createdToken.value = null
  displayToken.value = ''
  step.value = 'config'
}

// Handle dialog close
const handleClose = () => {
  emit('update:open', false)
  setTimeout(() => resetForm(), 300) // Delay to avoid visual glitch
}

// Handle token type change
const handleTokenTypeChange = (type: 'global' | 'team') => {
  tokenType.value = type
  expiresInHours.value = type === 'global' ? 1 : 24
  if (type === 'team' && userTeams.value.length > 0) {
    teamId.value = userTeams.value[0]?.id || ''
  }
}

// Create token
const handleCreateToken = async () => {
  try {
    isCreating.value = true

    const request: CreateTokenRequest = {
      token_type: tokenType.value,
      expires_in_hours: expiresInHours.value,
      ...(tokenType.value === 'team' && { team_id: teamId.value })
    }

    const response = await SatelliteTokenService.createToken(request)

    if (response.success) {
      createdToken.value = response.data.token
      displayToken.value = response.data.token.token

      await nextTick()
      step.value = 'result'
    } else {
      throw new Error('Failed to create registration token')
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to create token'
    toast.error(t('satellites.pairing.toasts.createError.title'), {
      description: errorMessage
    })
  } finally {
    isCreating.value = false
  }
}

// Handle token creation complete
const handleComplete = () => {
  if (createdToken.value) {
    emit('token-created', createdToken.value)
  }
  handleClose()
}

// Copy token to clipboard
const copyToken = () => {
  if (displayToken.value) {
    navigator.clipboard.writeText(displayToken.value)
    toast.success(t('satellites.pairing.toasts.tokenCopied.title'))
  }
}

// Format expiration time based on user input
const formatExpirationTime = () => {
  return `${expiresInHours.value}h`
}

// Get selected team name
const selectedTeamName = computed(() => {
  if (tokenType.value === 'global') return null
  const team = userTeams.value.find(t => t.id === teamId.value)
  return team?.name || 'Unknown Team'
})
</script>

<template>
  <Dialog :open="props.open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
      <!-- Configuration Step -->
      <div v-if="step === 'config'">
        <DialogHeader>
          <DialogTitle>{{ t('satellites.pairing.createToken.title') }}</DialogTitle>
          <DialogDescription>
            {{ t('satellites.pairing.createToken.description') }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-6 py-4">
          <!-- Token Type Selection -->
          <div class="space-y-3">
            <Label>{{ t('satellites.pairing.createToken.form.tokenScope.label') }}</Label>

            <fieldset class="-space-y-px rounded-md bg-white">
              <!-- Global Token Option -->
              <label
                v-if="canCreateGlobal"
                class="group flex border border-gray-200 p-4 first:rounded-tl-md first:rounded-tr-md focus:outline-hidden has-[:checked]:relative has-[:checked]:border-indigo-200 has-[:checked]:bg-indigo-50 cursor-pointer"
              >
                <input
                  name="token-type"
                  value="global"
                  type="radio"
                  checked="true"
                  @change="handleTokenTypeChange('global')"
                  class="mt-0.5 size-4 shrink-0 text-indigo-600 border-gray-300 focus:ring-indigo-600"
                />
                <span class="ml-3 flex flex-col">
                  <span class="block text-sm font-medium text-gray-900 group-has-[:checked]:text-indigo-900">{{ t('satellites.pairing.createToken.form.tokenScope.global.title') }}</span>
                  <span class="block text-sm text-gray-500 group-has-[:checked]:text-indigo-700">{{ t('satellites.pairing.createToken.form.tokenScope.global.description') }}</span>
                </span>
              </label>

              <!-- Team Token Option (Disabled) -->
              <label class="group flex border border-gray-200 p-4 last:rounded-br-md last:rounded-bl-md focus:outline-hidden opacity-50 cursor-not-allowed">
                <input
                  name="token-type"
                  value="team"
                  type="radio"
                  disabled
                  class="mt-0.5 size-4 shrink-0 text-gray-400 border-gray-300"
                />
                <span class="ml-3 flex flex-col">
                  <span class="block text-sm font-medium text-gray-900">{{ t('satellites.pairing.createToken.form.tokenScope.team.title') }}</span>
                  <span class="block text-sm text-gray-500">{{ t('satellites.pairing.createToken.form.tokenScope.team.description') }}</span>
                </span>
              </label>
            </fieldset>

            <!-- No Permissions Message -->
            <Alert v-if="!canCreateGlobal && !canCreateTeam">
              <AlertCircle class="h-4 w-4" />
              <AlertDescription>
                {{ t('satellites.pairing.createToken.noPermissions.description') }}
              </AlertDescription>
            </Alert>
          </div>

          <!-- Team Selection (for team tokens) -->
          <div v-if="tokenType === 'team' && canCreateTeam" class="space-y-2">
            <Label for="team-select">{{ t('satellites.pairing.createToken.form.teamSelect.label') }}</Label>
            <Select v-model="teamId" id="team-select">
              <SelectTrigger>
                <SelectValue :placeholder="t('satellites.pairing.createToken.form.teamSelect.placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="team in userTeams"
                  :key="team.id"
                  :value="team.id"
                >
                  {{ team.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <!-- Expiration Settings -->
          <div class="space-y-2">
            <Label for="expires">{{ t('satellites.pairing.createToken.form.expiration.label') }}</Label>
            <div class="flex items-center gap-4">
              <div class="flex-1">
                <Input
                  id="expires"
                  type="number"
                  :min="1"
                  :max="maxHours"
                  v-model.number="expiresInHours"
                />
              </div>
              <span class="text-sm text-muted-foreground">{{ t('satellites.pairing.createToken.form.expiration.unit') }}</span>
            </div>
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock class="h-3 w-3" />
              <span>
                {{ t('satellites.pairing.createToken.form.expiration.recommended', { hours: recommendedHours, type: tokenType, max: maxHours }) }}
              </span>
            </div>
          </div>

          <!-- Security Notice -->
          <Alert>
            <AlertCircle class="h-4 w-4" />
            <AlertDescription>
              <strong>{{ t('satellites.pairing.createToken.securityNotice.title') }}</strong> {{ t('satellites.pairing.createToken.securityNotice.description') }}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="handleClose">
            {{ t('satellites.pairing.createToken.buttons.cancel') }}
          </Button>
          <Button
            @click="handleCreateToken"
            :disabled="isCreating || (!canCreateGlobal && !canCreateTeam)"
          >
            <Spinner v-if="isCreating" class="mr-2" />
            {{ t('satellites.pairing.createToken.buttons.create') }}
          </Button>
        </DialogFooter>
      </div>

      <!-- Result Step -->
      <div v-else-if="step === 'result' && createdToken">
        <DialogHeader>
          <DialogTitle>{{ t('satellites.pairing.tokenCreated.title') }}</DialogTitle>
          <DialogDescription>
            {{ t('satellites.pairing.tokenCreated.description') }}
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-6 py-4">
          <!-- Token Summary -->
          <div class="space-y-3">
            <div class="font-medium">
              {{ tokenType === 'global' ? t('satellites.pairing.tokenCreated.summary.globalToken') : t('satellites.pairing.tokenCreated.summary.teamToken') }}
            </div>
            <div class="space-y-1 text-sm text-muted-foreground">
              <div v-if="tokenType === 'team'">
                {{ t('satellites.pairing.tokenCreated.summary.team', { teamName: selectedTeamName }) }}
              </div>
              <div>
                {{ t('satellites.pairing.tokenCreated.summary.expiresIn', { time: formatExpirationTime() }) }}
              </div>
              <div>
                {{ t('satellites.pairing.tokenCreated.summary.singleUse') }}
              </div>
            </div>
          </div>

          <hr class="border-gray-200" />

          <!-- Token Value -->
          <div class="space-y-2">
            <Label>{{ t('satellites.pairing.tokenCreated.sections.token') }}</Label>
            <Textarea
              v-model="displayToken"
              class="font-mono text-sm min-h-[80px] resize-none"
              rows="3"
              readonly
            />
          </div>

        </div>

        <DialogFooter class="gap-2">
          <Button variant="outline" @click="copyToken">
            <Copy class="h-4 w-4 mr-2" />
            {{ t('satellites.actions.copyToken') }}
          </Button>
          <Button @click="handleComplete">
            {{ t('satellites.pairing.createToken.buttons.done') }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
