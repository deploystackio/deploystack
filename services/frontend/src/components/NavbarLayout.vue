<script setup lang="ts">
import { DsNavbar } from '@/components/ui/ds-navbar'
import { DsContentWrapper } from '@/components/ui/ds-content-wrapper'
</script>

<template>
  <div class="min-h-screen bg-neutral-50">
    <!-- Navbar (2 rows: Brand row + Navigation row) -->
    <DsNavbar />

    <!-- Main Content -->
    <main class="py-8">
      <DsContentWrapper>
        <slot />
      </DsContentWrapper>
    </main>
  </div>
</template>
