<script setup lang="ts">
import { computed } from 'vue'
import type { StyleValue } from 'vue'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import AppSidebar from '@/components/AppSidebar.vue'
import SiteHeader from '@/components/SiteHeader.vue'

// TODO: Implement cookie-based persistence for defaultOpen if needed, like in the shadcn/ui example.
// For now, defaulting to true.
const defaultOpen = true

// Define sidebar width using custom values
const sidebarStyle = computed(() => ({
  '--sidebar-width': '16rem',
  '--sidebar-width-mobile': '18rem',
  '--sidebar-width-icon': '4rem',
} as StyleValue))
</script>

<template>
  <SidebarProvider :default-open="defaultOpen" :style="sidebarStyle">
    <AppSidebar variant="inset" />
    <SidebarInset class="px-5">
      <SiteHeader />

      <Separator class="mb-6 max-w-7xl" />

      <!-- Content area -->
      <div class="flex flex-1 flex-col gap-4 py-4 pt-0 max-w-7xl">
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
