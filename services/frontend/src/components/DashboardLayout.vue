<script setup lang="ts">
import { computed } from 'vue'
import type { StyleValue } from 'vue'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import AppSidebar from '@/components/AppSidebar.vue'

interface Props {
  title: string
}
const props = defineProps<Props>()

// TODO: Implement cookie-based persistence for defaultOpen if needed, like in the shadcn/ui example.
// For now, defaulting to true.
const defaultOpen = true

// Define sidebar width using custom values
// Override the collapsed width to 30rem for testing
const sidebarStyle = computed(() => ({
  '--sidebar-width': '16rem',
  '--sidebar-width-mobile': '18rem',
  '--sidebar-width-icon': '4rem',
} as StyleValue))

// A simple ref for the SiteHeader, can be expanded later
// For now, just using the title prop.
</script>

<template>
  <SidebarProvider :default-open="defaultOpen" :style="sidebarStyle">
    <AppSidebar variant="inset" />
    <SidebarInset class="px-5">
      <!-- SiteHeader equivalent -->
      <header class="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div class="flex items-center gap-2 px-4">
          <SidebarTrigger class="-ml-1" />
          <h1 class="text-lg font-semibold md:text-xl">{{ props.title }}</h1>
        </div>
      </header>

      <Separator class="my-6" />

      <!-- Content area -->
      <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
        <slot />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>

<style>
/* Optional: Ensure body doesn't scroll if the layout is truly full-page */
/* body {
  overflow: hidden;
} */

/* Fix the sidebar layout by ensuring CSS variables work */
.group\/sidebar-wrapper {
  display: flex;
  min-height: 100svh;
  width: 100%;
}

/* Ensure the spacer div actually takes up space when expanded */
.group\/sidebar-wrapper .group.peer[data-state="expanded"] [class*="w-[--sidebar-width]"] {
  width: var(--sidebar-width);
}

/* Allow the spacer to collapse when sidebar is collapsed */
.group\/sidebar-wrapper .group.peer[data-state="collapsed"] [class*="w-[--sidebar-width]"] {
  width: var(--sidebar-width-icon);
}

/* Force the main content to account for sidebar space */
@media (min-width: 768px) {
  .group\/sidebar-wrapper:has([data-variant="inset"]) main {
    margin: 0.5rem;
    margin-left: 0;
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  }

  /* Ensure the sidebar spacer works */
  .group\/sidebar-wrapper .group.peer {
    flex-shrink: 0;
  }
}
</style>
