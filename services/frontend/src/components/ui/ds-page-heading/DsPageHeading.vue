<script setup lang="ts">
import { RouterLink } from 'vue-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useBreadcrumbs } from '@/composables/useBreadcrumbs'

const { breadcrumbs } = useBreadcrumbs()
</script>

<template>
  <div class="mb-6">
    <Breadcrumb>
      <BreadcrumbList>
        <template v-for="(item, index) in breadcrumbs" :key="index">
          <BreadcrumbItem>
            <BreadcrumbLink v-if="item.href" as-child>
              <RouterLink :to="item.href">
                {{ item.label }}
              </RouterLink>
            </BreadcrumbLink>
            <BreadcrumbPage v-else>
              {{ item.label }}
            </BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator v-if="index < breadcrumbs.length - 1" />
        </template>
      </BreadcrumbList>
    </Breadcrumb>
  </div>
</template>
