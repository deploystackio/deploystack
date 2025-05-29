/* eslint-disable @typescript-eslint/no-explicit-any */
import { ref, computed, type Ref } from 'vue'

type ExtensionComponent = {
  id: string
  pluginId: string
  component: any
  props?: Record<string, any>
  order?: number
}

const extensionPoints = ref(new Map<string, ExtensionComponent[]>())

export function registerExtensionPoint(
  pointId: string,
  component: any,
  pluginId: string,
  options: { props?: Record<string, any>, order?: number } = {}
) {
  const extensions = extensionPoints.value.get(pointId) || []
  extensions.push({
    id: `${pluginId}-${Date.now()}`,
    pluginId,
    component,
    props: options.props,
    order: options.order || 0
  })

  // Sort by order
  extensions.sort((a, b) => (a.order || 0) - (b.order || 0))

  extensionPoints.value.set(pointId, extensions)
}

export function getExtensionPoint(pointId: string): Ref<ExtensionComponent[]> {
  return computed(() => extensionPoints.value.get(pointId) || [])
}

export function removePluginExtensions(pluginId: string) {
  for (const [pointId, extensions] of extensionPoints.value.entries()) {
    const filtered = extensions.filter(ext => ext.pluginId !== pluginId)
    extensionPoints.value.set(pointId, filtered)
  }
}
