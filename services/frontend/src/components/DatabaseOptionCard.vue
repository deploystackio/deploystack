<template>
  <div
    class="database-card border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md"
    :class="{ 'border-primary bg-primary/5 ring-2 ring-primary/20': selected, 'border-border hover:border-primary/50': !selected }"
    @click="$emit('select', database.type)"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <div class="flex items-center gap-2 mb-2">
          <h3 class="font-semibold text-lg">{{ $t(database.name) }}</h3>
          <Badge :variant="getBadgeVariant(database.recommended)">
            {{ $t(`setup.recommended.${database.recommended}`) }}
          </Badge>
        </div>

        <p class="text-sm text-muted-foreground font-medium mb-2">{{ $t(database.subtitle) }}</p>
        <p class="text-sm mb-3 text-foreground/80">{{ $t(database.description) }}</p>

        <ul class="text-xs space-y-1">
          <li v-for="feature in database.features" :key="feature" class="flex items-center">
            <Check class="h-3 w-3 mr-2 text-green-500 flex-shrink-0" />
            <span>{{ $t(feature) }}</span>
          </li>
        </ul>

        <!-- Environment Variables Info -->
        <div v-if="database.requiresEnvVars" class="mt-3 pt-3 border-t border-border/50">
          <p class="text-xs text-muted-foreground mb-1">{{ $t('setup.environmentVars.required') }}:</p>
          <div class="flex flex-wrap gap-1">
            <code
              v-for="envVar in database.envVars"
              :key="envVar"
              class="text-xs bg-muted px-1.5 py-0.5 rounded"
            >
              {{ envVar }}
            </code>
          </div>
        </div>
      </div>

      <!-- Selection Indicator -->
      <div class="ml-4 flex-shrink-0">
        <div
          class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
          :class="selected ? 'border-primary bg-primary' : 'border-muted-foreground/30'"
        >
          <Check v-if="selected" class="h-3 w-3 text-primary-foreground" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import type { DatabaseOption } from '@/types/database';

interface Props {
  database: DatabaseOption;
  selected: boolean;
}

defineProps<Props>();

defineEmits<{
  select: [type: string];
}>();

const getBadgeVariant = (recommended: string) => {
  switch (recommended) {
    case 'production':
      return 'default';
    case 'development':
      return 'secondary';
    case 'advanced':
      return 'outline';
    default:
      return 'secondary';
  }
};
</script>

<style scoped>
.database-card {
  transition: all 0.2s ease-in-out;
}
</style>
