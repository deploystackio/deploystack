import type { Plugin } from '../plugin-system/types'
import HelloWorldPlugin from './hello-world'

export async function loadPlugins(): Promise<Plugin[]> {
  return [
    new HelloWorldPlugin(),
    // Add more plugins here as needed
  ]
}
