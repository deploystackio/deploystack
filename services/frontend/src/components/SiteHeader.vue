<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
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
  <header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
    <div class="flex items-center gap-2 px-4">
      <SidebarTrigger class="-ml-1" />
      <Separator orientation="vertical" class="mr-2! h-4! bg-muted-foreground/50" />
      <Breadcrumb>
        <BreadcrumbList>
          <template v-for="(item, index) in breadcrumbs" :key="index">
            <BreadcrumbItem :class="{ 'hidden md:block': index < breadcrumbs.length - 1 }">
              <BreadcrumbLink v-if="item.href" as-child>
                <RouterLink :to="item.href">
                  {{ item.label }}
                </RouterLink>
              </BreadcrumbLink>
              <BreadcrumbPage v-else>
                {{ item.label }}
              </BreadcrumbPage>
            </BreadcrumbItem>
            <BreadcrumbSeparator
              v-if="index < breadcrumbs.length - 1"
              class="hidden md:block"
            />
          </template>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  </header>
</template>
