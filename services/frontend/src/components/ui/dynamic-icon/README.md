# Dynamic Icon Component

A dynamic icon loader component that imports Lucide icons on-demand without static imports. Supports all 1600+ Lucide icons with smart fallbacks and optimal performance through dynamic imports.

## Features

- **Dynamic Loading**: Imports only the icons you actually use
- **Smart Fallbacks**: Automatically handles missing or invalid icon names
- **Name Flexibility**: Supports various naming conventions (Database, database, shopping-cart)
- **Performance Optimized**: No bundle bloat from unused icons
- **TypeScript Support**: Fully typed with proper error handling
- **Global Caching**: Icons are cached globally for instant reuse
- **Accessibility**: Maintains proper icon semantics
- **Consistent Styling**: Integrates with shadcn/vue design system

## Installation & Setup

The component is already integrated into your DeployStack frontend. Simply import and use:

```vue
<script setup>
import { DynamicIcon } from '@/components/ui/dynamic-icon'
</script>
```

## Usage

### Basic Usage

```vue
<script setup>
import { DynamicIcon } from '@/components/ui/dynamic-icon'
</script>

<template>
  <!-- Simple icon rendering -->
  <DynamicIcon name="Database" class="h-4 w-4" />
  
  <!-- With custom styling -->
  <DynamicIcon 
    name="Shield" 
    class="h-6 w-6 text-green-600" 
  />
  
  <!-- Fallback for invalid icons -->
  <DynamicIcon 
    name="NonExistentIcon" 
    class="h-4 w-4 text-muted-foreground" 
  />
</template>
```

### Category Icons in Tables

```vue
<script setup>
import { DynamicIcon } from '@/components/ui/dynamic-icon'

// Category data from database
const category = {
  id: '1',
  name: 'Database',
  icon: 'Database' // Stored as string in database
}
</script>

<template>
  <div class="flex items-center gap-2">
    <DynamicIcon 
      :name="category.icon" 
      class="h-4 w-4 text-muted-foreground" 
    />
    <span>{{ category.name }}</span>
  </div>
</template>
```

### Dynamic Icons in Forms

```vue
<script setup>
import { DynamicIcon } from '@/components/ui/dynamic-icon'

const selectedIcon = ref('Globe')
const availableIcons = [
  'Database', 'Shield', 'Globe', 'Code', 'Brain', 
  'Cloud', 'Package', 'Settings', 'Heart', 'Star'
]
</script>

<template>
  <div class="space-y-4">
    <!-- Icon Preview -->
    <div class="flex items-center gap-2 p-4 border rounded-md">
      <DynamicIcon 
        :name="selectedIcon" 
        class="h-8 w-8 text-primary" 
      />
      <span>{{ selectedIcon || 'No icon selected' }}</span>
    </div>
    
    <!-- Icon Selection -->
    <div class="grid grid-cols-5 gap-2">
      <button
        v-for="iconName in availableIcons"
        :key="iconName"
        @click="selectedIcon = iconName"
        class="p-2 border rounded hover:bg-accent flex items-center justify-center"
      >
        <DynamicIcon 
          :name="iconName" 
          class="h-5 w-5" 
        />
      </button>
    </div>
  </div>
</template>
```

## API Reference

### DynamicIcon Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | `string \| null \| undefined` | `null` | Icon name to load (case-insensitive) |
| `class` | `string` | `'h-4 w-4'` | CSS classes for styling |

### Icon Name Resolution

The component automatically tries multiple variations to find the correct icon:

1. **Exact match**: `"Database"` → looks for `Database`
2. **Lowercase**: `"Database"` → looks for `database`
3. **PascalCase**: `"database"` → looks for `Database`
4. **camelCase**: `"Database"` → looks for `database`
5. **kebab-case**: `"ShoppingCart"` → looks for `shopping-cart`
6. **Space to dash**: `"Globe Lock"` → looks for `globe-lock`
7. **Remove spaces**: `"Data Base"` → looks for `database`
8. **Icon suffix**: `"Database"` → looks for `DatabaseIcon`
9. **Lucide prefix**: `"Database"` → looks for `LucideDatabase`

### Supported Icon Names

The component supports **all 1600+ Lucide icon names**. Popular examples:

#### Development & Code
```vue
<DynamicIcon name="Code" />
<DynamicIcon name="Terminal" />
<DynamicIcon name="Github" />
<DynamicIcon name="GitBranch" />
```

#### Database & Storage
```vue
<DynamicIcon name="Database" />
<DynamicIcon name="HardDrive" />
<DynamicIcon name="Server" />
<DynamicIcon name="Cloud" />
```

#### Security & Authentication
```vue
<DynamicIcon name="Shield" />
<DynamicIcon name="Lock" />
<DynamicIcon name="Key" />
<DynamicIcon name="Fingerprint" />
```

#### Communication & Social
```vue
<DynamicIcon name="Mail" />
<DynamicIcon name="MessageSquare" />
<DynamicIcon name="Phone" />
<DynamicIcon name="Globe" />
```

#### System & Tools
```vue
<DynamicIcon name="Settings" />
<DynamicIcon name="Wrench" />
<DynamicIcon name="Cpu" />
<DynamicIcon name="Monitor" />
```

#### Any Lucide Icon
```vue
<DynamicIcon name="Coffee" />
<DynamicIcon name="Zap" />
<DynamicIcon name="Wifi" />
<DynamicIcon name="Camera" />
<DynamicIcon name="Calendar" />
<DynamicIcon name="ShoppingCart" />
```

## Performance Features

### Bundle Size Optimization

- **Dynamic Loading**: Only loads icons that are actually used
- **Global Caching**: Icons are cached globally across all component instances
- **Lazy Loading**: Icons load asynchronously without blocking the page
- **Smart Deduplication**: Prevents loading the same icon multiple times

### Loading Behavior

```vue
<template>
  <!-- First use: loads asynchronously -->
  <DynamicIcon name="Database" /> <!-- Shows Tag fallback briefly, then Database -->
  
  <!-- Subsequent uses: instant (cached) -->
  <DynamicIcon name="Database" /> <!-- Instant render from cache -->
</template>
```

## Error Handling & Fallbacks

### Invalid Icon Names

```vue
<template>
  <!-- These all show the fallback Tag icon -->
  <DynamicIcon name="InvalidIcon" />
  <DynamicIcon name="" />
  <DynamicIcon :name="null" />
  <DynamicIcon :name="undefined" />
</template>
```

### Development Debugging

In development mode, the component provides helpful console logs:

```
[DynamicIcon] Trying to load "Database" with variations: ["Database", "database", ...]
[DynamicIcon] Found icon "Database" using variation: "Database"
```

## Integration Examples

### Category Management

```vue
<script setup>
import { DynamicIcon } from '@/components/ui/dynamic-icon'

const categories = [
  { id: '1', name: 'Database', icon: 'Database' },
  { id: '2', name: 'API Services', icon: 'Globe' },
  { id: '3', name: 'Security', icon: 'Shield' },
  { id: '4', name: 'AI Tools', icon: 'Brain' }
]
</script>

<template>
  <div class="grid grid-cols-2 gap-4">
    <div 
      v-for="category in categories" 
      :key="category.id"
      class="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent"
    >
      <DynamicIcon 
        :name="category.icon" 
        class="h-6 w-6 text-primary" 
      />
      <span class="font-medium">{{ category.name }}</span>
    </div>
  </div>
</template>
```

### Server Status Icons

```vue
<script setup>
import { DynamicIcon } from '@/components/ui/dynamic-icon'

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'running': return 'CheckCircle'
    case 'stopped': return 'Square'
    case 'error': return 'XCircle'
    case 'pending': return 'Clock'
    default: return 'HelpCircle'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'running': return 'text-green-600'
    case 'stopped': return 'text-gray-600'
    case 'error': return 'text-red-600'
    case 'pending': return 'text-yellow-600'
    default: return 'text-muted-foreground'
  }
}
</script>

<template>
  <div class="space-y-2">
    <div 
      v-for="server in servers" 
      :key="server.id"
      class="flex items-center gap-2"
    >
      <DynamicIcon 
        :name="getStatusIcon(server.status)" 
        :class="['h-4 w-4', getStatusColor(server.status)]" 
      />
      <span>{{ server.name }}</span>
      <Badge :variant="getStatusVariant(server.status)">
        {{ server.status }}
      </Badge>
    </div>
  </div>
</template>
```

## Accessibility

### Screen Reader Support

```vue
<template>
  <!-- Icon with semantic meaning -->
  <div class="flex items-center gap-2">
    <DynamicIcon 
      name="CheckCircle" 
      class="h-4 w-4 text-green-600" 
      aria-hidden="true"
    />
    <span>Deployment successful</span>
  </div>
  
  <!-- Decorative icon -->
  <DynamicIcon 
    name="Star" 
    class="h-4 w-4" 
    aria-hidden="true" 
  />
</template>
```

### Icon as Button

```vue
<template>
  <button 
    class="p-2 hover:bg-accent rounded"
    :aria-label="t('actions.settings')"
  >
    <DynamicIcon 
      name="Settings" 
      class="h-4 w-4" 
      aria-hidden="true" 
    />
  </button>
</template>
```

## Migration from Static Icons

### Before (Static Imports - ❌ Limited)

```vue
<script setup>
import { Database, Shield, Globe, Settings } from 'lucide-vue-next'
// Bundle includes all imported icons
// Limited to manually imported icons
</script>

<template>
  <Database class="h-4 w-4" />
  <Shield class="h-4 w-4" />
  <Globe class="h-4 w-4" />
  <Settings class="h-4 w-4" />
</template>
```

### After (Dynamic Icons - ✅ All 1600+ Icons)

```vue
<script setup>
import { DynamicIcon } from '@/components/ui/dynamic-icon'
// No static icon imports needed
// Access to all 1600+ Lucide icons
</script>

<template>
  <DynamicIcon name="Database" class="h-4 w-4" />
  <DynamicIcon name="Shield" class="h-4 w-4" />
  <DynamicIcon name="Globe" class="h-4 w-4" />
  <DynamicIcon name="Settings" class="h-4 w-4" />
  
  <!-- Plus any other Lucide icon -->
  <DynamicIcon name="Coffee" class="h-4 w-4" />
  <DynamicIcon name="Zap" class="h-4 w-4" />
  <DynamicIcon name="Camera" class="h-4 w-4" />
</template>
```

## Best Practices

### Icon Name Storage

When storing icon names in your database:

```sql
-- Store as PascalCase for consistency
CREATE TABLE categories (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  icon VARCHAR(100), -- Store as "Database", "ShoppingCart", etc.
  created_at TIMESTAMP DEFAULT NOW()
);
```

### TypeScript Interfaces

```typescript
// Define clear interfaces for icon-related data
interface Category {
  id: string
  name: string
  icon?: string | null // Allow null for categories without icons
  description?: string
}

interface IconConfig {
  name: string
  class?: string
  ariaLabel?: string
}
```

### Performance Tips

```vue
<template>
  <!-- ✅ Good: Cache icons by using consistent names -->
  <DynamicIcon name="Database" class="h-4 w-4" />
  <DynamicIcon name="Database" class="h-6 w-6" /> <!-- Reuses cached icon -->
  
  <!-- ⚠️ Avoid: Dynamic icon name changes that prevent caching -->
  <DynamicIcon :name="Math.random() > 0.5 ? 'Database' : 'database'" />
</template>
```

## Integration with DeployStack

This component is designed specifically for DeployStack's needs:

- **✅ Category Icons**: MCP server categories with user-selectable icons
- **✅ Status Indicators**: Server states with appropriate icons
- **✅ Admin Interface**: Icon selection in category/server management
- **✅ Dashboard Cards**: Visual indicators throughout the UI
- **✅ User Flexibility**: Users can choose from 1600+ icons
- **✅ Performance**: Optimal bundle size and loading

The component follows DeployStack's design system and integrates seamlessly with shadcn/vue components.

## Technical Implementation

### File Structure
```
src/components/ui/dynamic-icon/
├── DynamicIcon.vue     # Main component (Vue SFC)
├── README.md           # This documentation
└── index.ts           # Export definitions
```

### Key Features
- **Vue 3 Composition API** with `<script setup>` syntax
- **TypeScript Support** with proper type definitions
- **Vite Compatibility** using `import.meta.env.DEV`
- **Smart Caching** with global Map for performance
- **Error Boundaries** with graceful fallbacks
- **Development Debugging** with helpful console logs

## Troubleshooting

### Icon Not Loading
1. Check browser console for loading messages
2. Verify icon name exists in [Lucide Icons](https://lucide.dev/icons/)
3. Try different name variations (Database, database, shopping-cart)

### Performance Issues
1. Icons are cached globally - first load may be slower
2. Check network tab for dynamic imports
3. Use consistent icon names to leverage caching

### TypeScript Errors
1. Ensure proper import: `import { DynamicIcon } from '@/components/ui/dynamic-icon'`
2. Icon names should be strings: `name="Database"` not `name={Database}`
