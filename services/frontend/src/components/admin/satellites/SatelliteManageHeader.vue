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
import type { Satellite } from '@/services/satelliteService'
import { SatelliteStatusBadge, SatelliteActionsMenu } from '@/components/admin/satellites'

interface Props {
  satellite: Satellite | null
  isLoading?: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  satelliteUpdated: [satellite: Satellite]
}>()
const { t } = useI18n()
</script>

<template>
  <DsPageHeading :title="satellite?.name || t('satellites.manage.loading')">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <RouterLink to="/admin/satellites">
              {{ t('satellites.title') }}
            </RouterLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage v-if="satellite">{{ satellite.name }}</BreadcrumbPage>
          <Skeleton v-else class="h-4 w-32" />
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <template #actions>
      <SatelliteStatusBadge v-if="satellite" :status="satellite.status" />
      <SatelliteActionsMenu
        v-if="satellite"
        :satellite="satellite"
        @satellite-updated="emit('satelliteUpdated', $event)"
      />
    </template>
  </DsPageHeading>
</template>
