<script setup lang="ts">
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { ShieldX } from 'lucide-vue-next'
</script>

<template>
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <ShieldX />
      </EmptyMedia>
      <EmptyTitle>Access Denied</EmptyTitle>
      <EmptyDescription>
        You don't have permission to view logs. Only team administrators can access this section.
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
</template>
