<script setup lang="ts">
import { computed, ref } from 'vue' // Added ref
import type { StyleValue } from 'vue'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar' // Assuming SidebarTrigger might be needed
import AppSidebar from '@/components/AppSidebar.vue'

interface Props {
  title: string
}
const props = defineProps<Props>()

// TODO: Implement cookie-based persistence for defaultOpen if needed, like in the shadcn/ui example.
// For now, defaulting to true.
const defaultOpen = ref(true)

// Define sidebar width. The shadcn/ui example uses `calc(var(--spacing) * 72)`.
// Assuming var(--spacing) is ~4px, this is 288px. Let's use 18rem (288px).
// The shadcn-vue sidebar components should pick up this CSS variable.
const sidebarStyle = computed(() => ({
  '--sidebar-width': '18rem',
  // '--sidebar-width-mobile': '16rem', // Optional: if your AppSidebar handles mobile width
} as StyleValue))

// A simple ref for the SiteHeader, can be expanded later
// For now, just using the title prop.
</script>

<template>
  <div class="flex h-screen w-full overflow-hidden"> {/* Ensure full screen and no body scroll */}
    <SidebarProvider :default-open="defaultOpen" :style="sidebarStyle">
      <AppSidebar variant="inset" />
      <SidebarInset>
        <!-- SiteHeader equivalent -->
        <header class="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
          <div class="flex items-center gap-2">
            <SidebarTrigger class="-ml-1 lg:hidden" />
            <h1 class="text-lg font-semibold md:text-xl">{{ props.title }}</h1>
          </div>
          <!-- Add other header elements like user menu, search, etc. here if needed -->
        </header>

        <!-- Main content area -->
        <main class="flex flex-1 flex-col overflow-auto p-4 pt-2 md:gap-4 md:p-6 md:pt-4">
          <slot />
        </main>
      </SidebarInset>
    </SidebarProvider>
  </div>
</template>

<style>
/* Optional: Ensure body doesn't scroll if the layout is truly full-page */
/* body {
  overflow: hidden;
} */
</style>
