<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Badge } from '@/components/ui/badge'
import { DsCard } from '@/components/ui/ds-card'
import { Mail, Github, Shield } from 'lucide-vue-next'
import type { User } from '../types'

const props = defineProps<{
  user: User
}>()

const { t } = useI18n()

// Computed properties for display
const displayName = computed(() => {
  const firstName = props.user.first_name || ''
  const lastName = props.user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || props.user.username
})

const authTypeBadge = computed(() => {
  const isEmail = props.user.auth_type === 'email_signup'
  return {
    variant: (isEmail ? 'default' : 'secondary') as 'default' | 'secondary',
    icon: isEmail ? Mail : Github,
    text: isEmail ? t('adminUsers.userDetail.values.email') : t('adminUsers.userDetail.values.github')
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- User Information Card -->
    <DsCard :title="t('adminUsers.userDetail.userInformation')">
      <p class="text-sm text-muted-foreground mb-6">
        {{ t('adminUsers.userDetail.personalDetails') }}
      </p>

      <dl class="divide-y divide-gray-100">
        <!-- Full Name -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.fullName') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            {{ displayName === user.username ? t('adminUsers.userDetail.values.notProvided') : displayName }}
          </dd>
        </div>

        <!-- Username -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.username') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">{{ user.username }}</dd>
        </div>

        <!-- Email -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.emailAddress') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">{{ user.email }}</dd>
        </div>

        <!-- Role -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.role') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            {{ user.role ? user.role.name : t('adminUsers.userDetail.values.noRoleAssigned') }}
          </dd>
        </div>

        <!-- Registration Method -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.registrationMethod') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            <Badge
              :variant="authTypeBadge.variant"
              class="flex items-center gap-1 w-fit"
            >
              <component :is="authTypeBadge.icon" class="h-3 w-3" />
              {{ authTypeBadge.text }}
            </Badge>
          </dd>
        </div>

        <!-- GitHub ID (if applicable) -->
        <div v-if="user.github_id" class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.githubId') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            <span class="font-mono">{{ user.github_id }}</span>
          </dd>
        </div>

        <!-- User Details -->
        <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4">
          <dt class="text-sm font-medium text-gray-900">{{ t('adminUsers.userDetail.fields.accountDetails') }}</dt>
          <dd class="mt-1 text-sm text-gray-700 sm:col-span-2 sm:mt-0">
            <div class="space-y-2">
              <div><span class="font-medium">{{ t('adminUsers.userDetail.values.firstName') }}</span> {{ user.first_name || t('adminUsers.userDetail.values.notProvided') }}</div>
              <div><span class="font-medium">{{ t('adminUsers.userDetail.values.lastName') }}</span> {{ user.last_name || t('adminUsers.userDetail.values.notProvided') }}</div>
              <div><span class="font-medium">{{ t('adminUsers.userDetail.values.userId') }}</span> <span class="font-mono text-xs">{{ user.id }}</span></div>
            </div>
          </dd>
        </div>
      </dl>
    </DsCard>

    <!-- Permissions Card -->
    <DsCard v-if="user.role && user.role.permissions.length > 0" :title="t('adminUsers.userDetail.fields.permissions')">
      <ul role="list" class="divide-y divide-gray-100 rounded-md border border-gray-200">
        <li
          v-for="permission in user.role.permissions"
          :key="permission"
          class="flex items-center justify-between py-4 pr-5 pl-4 text-sm"
        >
          <div class="flex w-0 flex-1 items-center">
            <Shield class="size-5 shrink-0 text-gray-400" aria-hidden="true" />
            <div class="ml-4 flex min-w-0 flex-1 gap-2">
              <span class="truncate font-medium">{{ permission }}</span>
            </div>
          </div>
          <div class="ml-4 shrink-0">
            <Badge variant="outline" class="text-xs">{{ t('adminUsers.userDetail.values.active') }}</Badge>
          </div>
        </li>
      </ul>
    </DsCard>
  </div>
</template>
