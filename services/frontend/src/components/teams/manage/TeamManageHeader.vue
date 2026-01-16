<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { DsPageHeading } from '@/components/ui/ds-page-heading'
import { useI18n } from 'vue-i18n'
import type { Team } from '@/services/teamService'

interface Props {
  team: Team | null
  isLoading?: boolean
}

defineProps<Props>()
const { t } = useI18n()
</script>

<template>
  <DsPageHeading :title="t('teams.title')">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/teams">
              {{ t('teams.title') }}
            </RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage v-if="team">{{ team.name }}</BreadcrumbPage>
          <Skeleton v-else class="h-4 w-32" />
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </DsPageHeading>
</template>
