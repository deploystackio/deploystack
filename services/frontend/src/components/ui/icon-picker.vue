<script setup lang="ts">
import { ref, computed } from 'vue'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { IconService, type IconOption } from '@/services/iconService'

interface Props {
  modelValue?: string
  placeholder?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const open = ref(false)
const searchQuery = ref('')
const icons = ref<IconOption[]>(IconService.getCommonIcons())
const isLoading = ref(false)
const cacheStatus = ref(IconService.getCacheStats())

// Handle search with lazy loading
const handleSearch = async (query: string) => {
  searchQuery.value = query

  if (query.length >= 3 && !isLoading.value) {
    isLoading.value = true
    try {
      icons.value = await IconService.searchIcons(query)
      cacheStatus.value = IconService.getCacheStats()
    } finally {
      isLoading.value = false
    }
  } else {
    icons.value = await IconService.searchIcons(query)
  }
}

const selectedIcon = computed(() =>
  icons.value.find(icon => icon.value === props.modelValue)
)

const selectIcon = (iconValue: string) => {
  emit('update:modelValue', iconValue)
  open.value = false
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button variant="outline" class="w-full justify-between">
        <span>{{ selectedIcon?.label || placeholder || 'Select icon...' }}</span>
        <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[calc(100vw-2rem)] sm:w-[377px] p-0" align="start">
      <Command>
        <CommandInput
          placeholder="Search icons... (3+ chars for all icons)"
          @update:model-value="handleSearch"
        />
        <CommandEmpty>
          <div v-if="isLoading" class="flex items-center justify-center py-4">
            <Loader2 class="h-4 w-4 animate-spin mr-2" />
            <span>Loading icons...</span>
          </div>
          <div v-else class="py-4">
            No icon found.
          </div>
        </CommandEmpty>
        <CommandList>
          <CommandGroup>
            <!-- Show cache status for development -->
            <div v-if="searchQuery.length >= 3" class="px-2 py-1 text-xs text-muted-foreground border-b">
              {{ cacheStatus.loaded ? `${cacheStatus.count} icons cached` : 'Loading from cache...' }}
            </div>

            <CommandItem
              v-for="icon in icons"
              :key="icon.value"
              :value="icon.value"
              @select="selectIcon(icon.value)"
            >
              <span>{{ icon.label }}</span>
              <Check
                v-if="props.modelValue === icon.value"
                class="ml-auto h-4 w-4"
              />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
