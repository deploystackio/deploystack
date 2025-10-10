<script setup lang="ts">
import Card from '@/components/ui/card/Card.vue'
import { Item } from '@/components/ui/item'

interface ClientConnection {
  id: string
  name: string
  type: string
  connectedAt: string
  status: 'active' | 'inactive'
}

const dummyClients: ClientConnection[] = [
  {
    id: '1',
    name: 'VS Code',
    type: 'Desktop Client',
    connectedAt: '2 hours ago',
    status: 'active'
  },
  {
    id: '2',
    name: 'Cursor',
    type: 'Desktop Client',
    connectedAt: '5 minutes ago',
    status: 'active'
  }
]
</script>

<template>
  <Card variant="gray">
    <div class="px-6">
      <h3 class="text-lg font-semibold mb-4">Client Connections</h3>
      <div class="space-y-3">
        <Item
          v-for="client in dummyClients"
          :key="client.id"
          variant="filled"
          class="cursor-pointer"
        >
          <div class="flex items-center justify-between w-full">
            <div class="flex flex-col">
              <span class="font-medium">{{ client.name }}</span>
              <span class="text-sm text-muted-foreground">{{ client.type }}</span>
            </div>
            <div class="flex flex-col items-end">
              <span class="text-xs text-muted-foreground">{{ client.connectedAt }}</span>
              <span
                class="text-xs font-medium"
                :class="{
                  'text-green-600': client.status === 'active',
                  'text-gray-400': client.status === 'inactive'
                }"
              >
                {{ client.status }}
              </span>
            </div>
          </div>
        </Item>
      </div>
    </div>
  </Card>
</template>
