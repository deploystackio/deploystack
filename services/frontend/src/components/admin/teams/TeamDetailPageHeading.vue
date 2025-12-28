<script setup lang="ts">
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
import type { Team } from '@/views/admin/teams/types'

interface Props {
  team: Team | null
  isLoading?: boolean
}

defineProps<Props>()
const { t } = useI18n()
</script>

<template>
  <!-- When team is loaded -->
  <DsPageHeading v-if="team" :title="team.name" :show-border="false">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/admin/teams">
              {{ t('adminTeams.title') }}
            </RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{{ team.name }}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </DsPageHeading>

  <!-- Loading state (shows skeleton breadcrumb) -->
  <DsPageHeading v-else :title="t('adminTeams.teamDetail.titleLoading')" :show-border="false">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/admin/teams">
              {{ t('adminTeams.title') }}
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
