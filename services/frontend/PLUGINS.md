# DeployStack Frontend Plugin System

This document explains how to create and integrate plugins into the DeployStack frontend application. The plugin system enables extending the frontend with additional functionality, UI components, routes, and state management.

## Overview

DeployStack's frontend plugin architecture allows for extensible, modular development. Plugins can:

- Add new UI components at designated extension points
- Register new routes in the Vue Router
- Add new Pinia stores for state management
- Extend core functionality in a modular way

## Plugin Structure

A basic plugin consists of the following files:

```bash
your-plugin/
├── index.ts         # Main plugin entry point
├── components/      # Plugin-specific components
│   └── ...
├── views/           # Plugin-specific views
│   └── ...
└── store.ts         # (Optional) Plugin-specific state management
```

### Required Files

1. **index.ts** - Implements the Plugin interface and exports the plugin class
2. **components/** - Contains Vue components used by the plugin

## Creating a New Plugin

### 1. Create Plugin Directory

Create a directory for your plugin in the plugins folder:

```bash
mkdir -p src/plugins/my-custom-plugin
cd src/plugins/my-custom-plugin
```

### 2. Create a Component

Create a simple Vue component that your plugin will provide:

```vue
<!-- src/plugins/my-custom-plugin/components/MyCustomComponent.vue -->
<script setup lang="ts">
const title = "My Custom Plugin Component"
const count = ref(0)

function increment() {
  count.value++
}
</script>

<template>
  <div class="p-4 my-4 bg-white rounded-lg shadow-md">
    <h2 class="text-xl font-bold text-indigo-600">{{ title }}</h2>
    <p class="mt-2 text-gray-600">
      This is a custom component from my plugin.
    </p>
    <div class="mt-4">
      <p class="text-gray-700">Count: {{ count }}</p>
      <button 
        @click="increment" 
        class="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        Increment
      </button>
    </div>
  </div>
</template>
```

### 3. Implement the Plugin Interface

Create an `index.ts` file that implements the Plugin interface:

```typescript
// src/plugins/my-custom-plugin/index.ts
import type { Plugin } from '@/plugin-system/types'
import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { Pinia } from 'pinia'
import { registerExtensionPoint } from '@/plugin-system/extension-points'
import MyCustomComponent from './components/MyCustomComponent.vue'

class MyCustomPlugin implements Plugin {
  meta = {
    id: 'my-custom-plugin',
    name: 'My Custom Plugin',
    version: '1.0.0',
    description: 'Adds custom functionality to DeployStack',
    author: 'Your Name',
  }
  
  initialize(_app: App, router: Router, _pinia: Pinia) {
    console.log('Initializing my custom plugin...')
    
    // Register components at extension points
    registerExtensionPoint('main-content', MyCustomComponent, this.meta.id)
    
    // Register routes (optional)
    router.addRoute({
      path: '/my-custom-page',
      name: 'MyCustomPage',
      component: () => import('./views/MyCustomPage.vue')
    })
    
    console.log('My custom plugin initialized successfully')
    return Promise.resolve()
  }
  
  cleanup() {
    console.log('Cleaning up my custom plugin...')
    return Promise.resolve()
  }
}

export default MyCustomPlugin
```

### 4. (Optional) Create a View

If your plugin adds new routes, create the view components:

```vue
<!-- src/plugins/my-custom-plugin/views/MyCustomPage.vue -->
<script setup lang="ts">
import MyCustomComponent from '../components/MyCustomComponent.vue'
</script>

<template>
  <div class="container mx-auto p-4">
    <h1 class="text-2xl font-bold mb-6">My Custom Plugin Page</h1>
    <MyCustomComponent />
    <p class="mt-4">
      This is a dedicated page provided by the my-custom-plugin.
    </p>
  </div>
</template>
```

### 5. (Optional) Add State Management

Create a Pinia store for your plugin if needed:

```typescript
// src/plugins/my-custom-plugin/store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMyCustomStore = defineStore('my-custom-plugin', () => {
  const data = ref([])
  const isLoading = ref(false)
  
  const count = computed(() => data.value.length)
  
  async function fetchData() {
    isLoading.value = true
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      data.value = ['item1', 'item2', 'item3']
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  return {
    data,
    isLoading,
    count,
    fetchData
  }
})
```

## Registering Your Plugin

Once you've created your plugin, you need to register it in the plugin loader:

```typescript
// src/plugins/index.ts
import type { Plugin } from '../plugin-system/types'
import HelloWorldPlugin from './hello-world'
import MyCustomPlugin from './my-custom-plugin'

export async function loadPlugins(): Promise<Plugin[]> {
  return [
    new HelloWorldPlugin(),
    new MyCustomPlugin(),
    // Add more plugins here
  ]
}
```

## Using Extension Points

To allow your plugins to extend the UI, you need to place extension points in your application. Extension points are markers where plugins can inject their components.

### 1. Adding Extension Points to Your App

```vue
<!-- In any of your App components or views -->
<template>
  <div class="my-app-section">
    <h2>My Application Section</h2>
    
    <!-- Extension point where plugins can add content -->
    <ExtensionPoint pointId="main-content" />
    
    <!-- You can have multiple extension points -->
    <ExtensionPoint pointId="sidebar" />
    
    <!-- You can specify which plugin to load by name -->
    <ExtensionPoint pointId="main-content" pluginName="hello-world" />
  </div>
</template>
```

### 2. Registering Components at Extension Points

In your plugin's `initialize` method:

```typescript
// Register a component at an extension point
registerExtensionPoint(
  'main-content',    // The ID of the extension point
  MyComponent,       // The component to render
  this.meta.id,      // Your plugin ID
  {
    props: { title: 'My Title' },  // Optional props to pass to the component
    order: 10,                     // Optional ordering (lower numbers appear first)
  }
)
```

### 3. Selectively Rendering Plugins

You can selectively render components from specific plugins using the `pluginName` prop:

```vue
<!-- In your views or components -->
<template>
  <!-- Render only the hello-world plugin components -->
  <ExtensionPoint pointId="main-content" pluginName="hello-world" />
  
  <!-- Render only another plugin's components -->
  <ExtensionPoint pointId="main-content" pluginName="my-custom-plugin" />
  
  <!-- Render all plugins registered at this extension point -->
  <ExtensionPoint pointId="main-content" />
</template>
```

This allows you to:

- Display specific plugins in different areas of your application
- Create plugin showcase pages
- Organize your plugin content based on functionality

## Advanced Plugin Features

### 1. Plugin Configuration

You can provide configuration for your plugins through the plugin manager:

```typescript
// In your main.ts or where you initialize the plugin manager
const pluginManager = new PluginManager({
  plugins: {
    'my-custom-plugin': {
      enabled: true,
      config: {
        apiUrl: 'https://api.example.com',
        maxItems: 10,
      }
    }
  }
})
```

Then in your plugin:

```typescript
initialize(_app: App, _router: Router, _pinia: Pinia, pluginManager: PluginManager) {
  // Get plugin configuration
  const config = pluginManager.getPluginConfig(this.meta.id)
  
  // Use the configuration
  const apiUrl = config?.apiUrl as string
  console.log('API URL:', apiUrl)
}
```

### 2. Plugin Dependencies

Plugins can check for the presence of other plugins:

```typescript
initialize(_app: App, _router: Router, _pinia: Pinia, pluginManager: PluginManager) {
  // Check if another plugin is available
  const hasAnotherPlugin = pluginManager.getPlugin('another-plugin-id')
  
  // Conditionally use functionality if available
  if (hasAnotherPlugin) {
    // Integrate with the other plugin
    console.log('Another plugin is available')
  }
}
```

### 3. Using Composables in Plugins

You can create and use Vue composables in your plugins:

```typescript
// src/plugins/my-custom-plugin/composables/useMyCustomFeature.ts
import { ref, computed } from 'vue'

export function useMyCustomFeature() {
  const value = ref(0)
  const doubled = computed(() => value.value * 2)
  
  function increment() {
    value.value++
  }
  
  return {
    value,
    doubled,
    increment
  }
}
```

Then in your components:

```vue
<script setup lang="ts">
import { useMyCustomFeature } from '../composables/useMyCustomFeature'

const { value, doubled, increment } = useMyCustomFeature()
</script>
```

## Plugin Lifecycle

Plugins follow this lifecycle:

1. **Loading** - Plugin is discovered and loaded
2. **Initialization** - `initialize` method is called with the Vue app, router, and Pinia
3. **Runtime** - Plugin operates as part of the application
4. **Cleanup** - `cleanup` method is called during application termination

## Best Practices

1. **Unique IDs** - Ensure your plugin ID is unique and descriptive
2. **Error Handling** - Properly handle errors in your plugin
3. **Component Naming** - Prefix your components with your plugin name to avoid conflicts
4. **Documentation** - Include a README.md with your plugin
5. **Versioning** - Use semantic versioning for your plugin

## Troubleshooting

### Plugin Not Initializing

- Check browser console for errors
- Verify that the plugin is being loaded in `src/plugins/index.ts`
- Ensure the plugin is implementing the correct interface

### Extension Points Not Showing Components

- Check that the extension point ID matches between registration and usage
- Verify that the component is being correctly imported and registered
- Look for errors in the component itself

### Router Issues

- Make sure route names are unique across all plugins
- Check that path conflicts are resolved

## Example Plugins

See the `src/plugins/hello-world` directory for a working example.
