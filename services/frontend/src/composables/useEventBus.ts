import { inject } from 'vue'
import type { Emitter } from 'mitt'

export type EventBusEvents = {
  'teams-updated': void
  'team-created': void
  'team-deleted': void
}

export function useEventBus() {
  const emitter = inject<Emitter<EventBusEvents>>('emitter')
  if (!emitter) {
    throw new Error('Event bus not provided. Make sure to provide the emitter in main.ts')
  }
  return emitter
}
