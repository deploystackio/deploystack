import { inject } from 'vue'
import type { Emitter } from 'mitt'

export type EventBusEvents = {
  'teams-updated': void
  'team-created': void
  'team-deleted': void
  'team-selected': { teamId: string; teamName: string }
  'credentials-updated': void
  'credential-created': { credentialId: string; credentialName: string }
  'credential-deleted': { credentialId: string; credentialName: string }
  'mcp-catalog-updated': void
  'mcp-server-created': void
  'mcp-server-updated': { serverId: string }
  'mcp-server-deleted': { serverId: string }
  'mcp-categories-updated': void
  'mcp-category-created': void
  'mcp-category-updated': { categoryId: string }
  'mcp-category-deleted': { categoryId: string }
  'mcp-form-data-updated': { step: number; data: any }
  'mcp-form-data-loaded': { formData: any; currentStep: number }
  'mcp-form-data-cleared': void
  'icons-cache-loaded': { count: number }
  'icons-cache-error': { message: string }
  'icons-cache-cleared': void
  'settings-updated': void
  'settings-group-updated': { groupId: string }
  'settings-connection-tested': { groupId: string; success: boolean; message: string }
}

export function useEventBus() {
  const emitter = inject<Emitter<EventBusEvents>>('emitter')
  if (!emitter) {
    throw new Error('Event bus not provided. Make sure to provide the emitter in main.ts')
  }
  return emitter
}
