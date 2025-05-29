<script setup lang="ts">
import { getExtensionPoint } from '@/plugin-system/extension-points'
import { computed } from 'vue'

const props = defineProps<{
  pointId?: string
  pluginName?: string
}>()

// Get all extensions for the given pointId
const allExtensions = getExtensionPoint(props.pointId || 'default')

// Filter extensions by plugin name if provided
const extensions = computed(() => {
  if (!props.pluginName) {
    return allExtensions.value
  }

  return allExtensions.value.filter(extension => extension.pluginId === props.pluginName)
})
</script>

<template>
  <div class="extension-point">
    <component
      v-for="extension in extensions"
      :key="extension.id"
      :is="extension.component"
      v-bind="extension.props || {}"
    />
  </div>
</template>
