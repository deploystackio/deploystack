import type { Plugin } from '@/plugin-system/types'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { Pinia } from 'pinia'
import { registerExtensionPoint } from '@/plugin-system/extension-points'
import HelloWorldComponent from './HelloWorldComponent.vue'

class HelloWorldPlugin implements Plugin {
  meta = {
    id: 'hello-world',
    name: 'Hello World Plugin',
    version: '1.0.0',
    description: 'A simple hello world plugin with red text',
    author: 'Your Name',
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  initialize(_app: App, _router: Router, _pinia: Pinia) {
    console.log('Initializing Hello World plugin...')

    // Register the component at the 'main-content' extension point
    registerExtensionPoint('main-content', HelloWorldComponent, this.meta.id)

    console.log('Hello World plugin initialized successfully')
    return Promise.resolve()
  }

  cleanup() {
    console.log('Cleaning up Hello World plugin...')
    // Automatic cleanup happens through removePluginExtensions
    return Promise.resolve()
  }
}

export default HelloWorldPlugin
