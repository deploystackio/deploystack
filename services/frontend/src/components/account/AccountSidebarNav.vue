<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface AccountSection {
  id: string
  name: string
  href: string
}

interface Props {
  canChangePassword?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canChangePassword: true
})

const route = useRoute()

const accountSections = computed((): AccountSection[] => {
  const sections = [
    {
      id: 'profile',
      name: 'Profile',
      href: '/user/profile',
    },
  ]
  
  // Only show Security section for users who can change password
  if (props.canChangePassword) {
    sections.push({
      id: 'security',
      name: 'Security',
      href: '/user/security',
    })
  }
  
  return sections
})
</script>

<template>
  <nav class="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
    <Button
      v-for="section in accountSections"
      :key="section.id"
      as-child
      variant="ghost"
      :class="cn(
        'w-full text-left justify-start',
        route.path === section.href && 'bg-muted hover:bg-muted',
      )"
    >
      <RouterLink :to="section.href">
        {{ section.name }}
      </RouterLink>
    </Button>
  </nav>
</template>
