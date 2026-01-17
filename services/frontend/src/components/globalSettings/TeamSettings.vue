<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsForm } from '@/composables/useSettingsForm'
import type { SettingsComponentProps, SettingsComponentEvents } from '@/composables/useSettingsComponentRegistry'
import { DsCard } from '@/components/ui/ds-card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { getEnv } from '@/utils/env'

const props = defineProps<SettingsComponentProps>()
const emit = defineEmits<SettingsComponentEvents>()

const apiUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL') || ''

// Use the settings form composable
const {
  formValues,
  updateField,
  getFieldError
} = useSettingsForm(props.settings)

// Separate loading states for each card
const isSavingCard1 = ref(false)
const isSavingCard2 = ref(false)
const isSavingCard3 = ref(false)
const isSavingCard4 = ref(false)

// Get setting by key
function getSetting(key: string) {
  return props.settings.find(s => s.key === key)
}

// Save specific settings by keys
async function saveSpecificSettings(keys: string[], cardNumber: number): Promise<boolean> {
  const loadingRef = cardNumber === 1 ? isSavingCard1 : cardNumber === 2 ? isSavingCard2 : cardNumber === 3 ? isSavingCard3 : isSavingCard4
  loadingRef.value = true

  try {
    const settingsToUpdate = keys.map(key => {
      const setting = props.settings.find(s => s.key === key)
      return {
        key,
        value: formValues.value[key],
        type: setting?.type,
        group_id: setting?.group_id,
        description: setting?.description,
        encrypted: setting?.is_encrypted || false
      }
    })

    const response = await fetch(`${apiUrl}/api/settings/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ settings: settingsToUpdate }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || errorData.message || `Failed to save settings: ${response.statusText}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.message || 'Failed to save settings')
    }

    return true
  } catch (error) {
    console.error('Failed to save settings:', error)
    return false
  } finally {
    loadingRef.value = false
  }
}

// Handle form submission for Card 1
async function handleSaveCard1() {
  const success = await saveSpecificSettings(['team.default_member_limit', 'team.creation_limit'], 1)
  if (success) {
    emit('settings-updated', props.settings)
  }
}

// Handle form submission for Card 2
async function handleSaveCard2() {
  const success = await saveSpecificSettings(['team.default_mcp_server_limit', 'team.default_non_http_mcp_limit'], 2)
  if (success) {
    emit('settings-updated', props.settings)
  }
}

// Handle form submission for Card 3 (GitHub MCP Integration)
async function handleSaveCard3() {
  const success = await saveSpecificSettings(['team.allow_github_mcp', 'team.allow_private_github_repos', 'team.github_mcp_limit'], 3)
  if (success) {
    emit('settings-updated', props.settings)
  }
}

// Handle form submission for Card 4 (Remote MCP Options)
async function handleSaveCard4() {
  const success = await saveSpecificSettings(['team.allow_remote_mcp'], 4)
  if (success) {
    emit('settings-updated', props.settings)
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Card 1: Team & Member Limits -->
    <DsCard title="Team & Member Limits">
      <p class="text-sm text-muted-foreground mb-6">
        Configure default limits for team creation and member capacity.
      </p>

      <div class="space-y-6">
        <!-- Default Team Member Limit -->
        <div class="space-y-2">
          <Label for="team-member-limit">
            {{ getSetting('team.default_member_limit')?.name || 'Default Team Member Limit' }}
          </Label>
          <Input
            id="team-member-limit"
            type="number"
            :model-value="String(formValues['team.default_member_limit'] || '')"
            @update:model-value="(value) => updateField('team.default_member_limit', Number(value))"
            placeholder="3"
            :class="{ 'border-destructive': getFieldError('team.default_member_limit') }"
          />
          <p v-if="getFieldError('team.default_member_limit')" class="text-sm text-destructive">
            {{ getFieldError('team.default_member_limit') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ getSetting('team.default_member_limit')?.description }}
          </p>
        </div>

        <!-- Team Creation Limit -->
        <div class="space-y-2">
          <Label for="team-creation-limit">
            {{ getSetting('team.creation_limit')?.name || 'Team Creation Limit' }}
          </Label>
          <Input
            id="team-creation-limit"
            type="number"
            :model-value="String(formValues['team.creation_limit'] || '')"
            @update:model-value="(value) => updateField('team.creation_limit', Number(value))"
            placeholder="3"
            :class="{ 'border-destructive': getFieldError('team.creation_limit') }"
          />
          <p v-if="getFieldError('team.creation_limit')" class="text-sm text-destructive">
            {{ getFieldError('team.creation_limit') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ getSetting('team.creation_limit')?.description }}
          </p>
        </div>
      </div>

      <template #footer-actions>
        <Button
          :disabled="isSavingCard1"
          @click="handleSaveCard1"
        >
          <Spinner v-if="isSavingCard1" class="mr-2" />
          Save Changes
        </Button>
      </template>
    </DsCard>

    <!-- Card 2: MCP Server Limits -->
    <DsCard title="MCP Server Limits">
      <p class="text-sm text-muted-foreground mb-6">
        Configure default limits for MCP server installations per team.
      </p>

      <div class="space-y-6">
        <!-- Default MCP Server Limit -->
        <div class="space-y-2">
          <Label for="mcp-server-limit">
            {{ getSetting('team.default_mcp_server_limit')?.name || 'Default MCP Server Limit' }}
          </Label>
          <Input
            id="mcp-server-limit"
            type="number"
            :model-value="String(formValues['team.default_mcp_server_limit'] || '')"
            @update:model-value="(value) => updateField('team.default_mcp_server_limit', Number(value))"
            placeholder="5"
            :class="{ 'border-destructive': getFieldError('team.default_mcp_server_limit') }"
          />
          <p v-if="getFieldError('team.default_mcp_server_limit')" class="text-sm text-destructive">
            {{ getFieldError('team.default_mcp_server_limit') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ getSetting('team.default_mcp_server_limit')?.description }}
          </p>
        </div>

        <!-- Default Non-HTTP MCP Limit -->
        <div class="space-y-2">
          <Label for="non-http-mcp-limit">
            {{ getSetting('team.default_non_http_mcp_limit')?.name || 'Default Non-HTTP MCP Limit' }}
          </Label>
          <Input
            id="non-http-mcp-limit"
            type="number"
            :model-value="String(formValues['team.default_non_http_mcp_limit'] || '')"
            @update:model-value="(value) => updateField('team.default_non_http_mcp_limit', Number(value))"
            placeholder="1"
            :class="{ 'border-destructive': getFieldError('team.default_non_http_mcp_limit') }"
          />
          <p v-if="getFieldError('team.default_non_http_mcp_limit')" class="text-sm text-destructive">
            {{ getFieldError('team.default_non_http_mcp_limit') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ getSetting('team.default_non_http_mcp_limit')?.description }}
          </p>
        </div>
      </div>

      <template #footer-actions>
        <Button
          :disabled="isSavingCard2"
          @click="handleSaveCard2"
        >
          <Spinner v-if="isSavingCard2" class="mr-2" />
          Save Changes
        </Button>
      </template>
    </DsCard>

    <!-- Card 3: GitHub MCP Integration -->
    <DsCard title="GitHub MCP Integration">
      <p class="text-sm text-muted-foreground mb-6">
        Configure GitHub repository access for MCP server installations.
      </p>

      <div class="space-y-6">
        <!-- Allow GitHub MCP Servers Checkbox -->
        <div class="flex items-start gap-3">
          <Checkbox
            id="allow-github-mcp"
            :checked="Boolean(formValues['team.allow_github_mcp'])"
            @update:checked="(value: boolean) => updateField('team.allow_github_mcp', value)"
          />
          <div class="grid gap-1">
            <label
              for="allow-github-mcp"
              class="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {{ getSetting('team.allow_github_mcp')?.name || 'Allow GitHub MCP Servers' }}
            </label>
            <p class="text-muted-foreground text-sm">
              {{ getSetting('team.allow_github_mcp')?.description }}
            </p>
          </div>
        </div>

        <!-- Allow Private GitHub Repositories Checkbox -->
        <div class="flex items-start gap-3">
          <Checkbox
            id="allow-private-github-repos"
            :checked="Boolean(formValues['team.allow_private_github_repos'])"
            @update:checked="(value: boolean) => updateField('team.allow_private_github_repos', value)"
          />
          <div class="grid gap-1">
            <label
              for="allow-private-github-repos"
              class="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {{ getSetting('team.allow_private_github_repos')?.name || 'Allow Private GitHub Repositories' }}
            </label>
            <p class="text-muted-foreground text-sm">
              {{ getSetting('team.allow_private_github_repos')?.description }}
            </p>
          </div>
        </div>

        <!-- GitHub MCP Server Limit -->
        <div class="space-y-2">
          <Label for="github-mcp-limit">
            {{ getSetting('team.github_mcp_limit')?.name || 'GitHub MCP Server Limit' }}
          </Label>
          <Input
            id="github-mcp-limit"
            type="number"
            :model-value="String(formValues['team.github_mcp_limit'] || '')"
            @update:model-value="(value) => updateField('team.github_mcp_limit', Number(value))"
            placeholder="0"
            :class="{ 'border-destructive': getFieldError('team.github_mcp_limit') }"
          />
          <p v-if="getFieldError('team.github_mcp_limit')" class="text-sm text-destructive">
            {{ getFieldError('team.github_mcp_limit') }}
          </p>
          <p class="text-xs text-muted-foreground">
            {{ getSetting('team.github_mcp_limit')?.description }}
          </p>
        </div>
      </div>

      <template #footer-actions>
        <Button
          :disabled="isSavingCard3"
          @click="handleSaveCard3"
        >
          <Spinner v-if="isSavingCard3" class="mr-2" />
          Save Changes
        </Button>
      </template>
    </DsCard>

    <!-- Card 4: Remote MCP Options -->
    <DsCard title="Remote MCP Options">
      <p class="text-sm text-muted-foreground mb-6">
        Control whether teams can install MCP servers from external sources.
      </p>

      <div class="space-y-6">
        <!-- Allow Remote MCP Checkbox -->
        <div class="flex items-start gap-3">
          <Checkbox
            id="allow-remote-mcp"
            :checked="Boolean(formValues['team.allow_remote_mcp'])"
            @update:checked="(value: boolean) => updateField('team.allow_remote_mcp', value)"
          />
          <div class="grid gap-1">
            <label
              for="allow-remote-mcp"
              class="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {{ getSetting('team.allow_remote_mcp')?.name || 'Allow Remote MCP Servers' }}
            </label>
            <p class="text-muted-foreground text-sm">
              {{ getSetting('team.allow_remote_mcp')?.description }}
            </p>
          </div>
        </div>
      </div>

      <template #footer-actions>
        <Button
          :disabled="isSavingCard4"
          @click="handleSaveCard4"
        >
          <Spinner v-if="isSavingCard4" class="mr-2" />
          Save Changes
        </Button>
      </template>
    </DsCard>
  </div>
</template>
