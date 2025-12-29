<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import type { User } from '@/views/admin/users/types'

interface Props {
  user: User | null
  isLoading?: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()

// Display name: first_name + last_name or fallback to username
const displayName = computed(() => {
  if (!props.user) return ''
  const firstName = props.user.first_name || ''
  const lastName = props.user.last_name || ''
  const fullName = `${firstName} ${lastName}`.trim()
  return fullName || props.user.username
})
</script>

<template>
  <!-- When user is loaded -->
  <DsPageHeading v-if="user" :title="displayName" :show-border="false">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/admin/users">
              {{ t('adminUsers.title') }}
            </RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{{ user.username }}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <!-- Actions slot for Force Reset Password button -->
    <template #actions>
      <slot name="actions" />
    </template>
  </DsPageHeading>

  <!-- Loading state (shows skeleton breadcrumb) -->
  <DsPageHeading v-else :title="t('adminUsers.userDetail.titleLoading')" :show-border="false">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/admin/users">
              {{ t('adminUsers.title') }}
            </RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <Skeleton class="h-4 w-48" />
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </DsPageHeading>
</template>
