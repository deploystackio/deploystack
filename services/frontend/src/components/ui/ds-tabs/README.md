# DS Tabs Component

A responsive tabs component for DeployStack with mobile dropdown and desktop navigation. Built following shadcn/vue design principles with full accessibility support and multiple visual variants.

## Features

- Responsive design with mobile dropdown and desktop navigation
- Multiple visual variants (default, underlined, pills, bordered)
- Multiple sizes (sm, md, lg)
- Full keyboard accessibility with arrow key navigation
- Support for badges and icons
- TypeScript support
- Both prop-based and slot-based APIs
- Dark mode support
- Customizable mobile breakpoint
- Disabled state support

## Usage

### Basic Usage

```html
<script setup>
import { ref } from 'vue'
import { DsTabs } from '@/components/ui/ds-tabs'

const activeTab = ref('account')

const tabs = [
  { value: 'account', label: 'My Account' },
  { value: 'company', label: 'Company' },
  { value: 'team', label: 'Team Members' },
  { value: 'billing', label: 'Billing', badge: '2' }
]
</script>

<template>
  <DsTabs v-model="activeTab" :tabs="tabs" />
</template>
```

### Slot-based Usage

```html
<script setup>
import { ref } from 'vue'
import { DsTabs, DsTabsItem } from '@/components/ui/ds-tabs'
import { User, Building, Users, CreditCard } from 'lucide-vue-next'

const activeTab = ref('account')
</script>

<template>
  <DsTabs v-model="activeTab" variant="underlined">
    <DsTabsItem value="account" label="My Account">
      <User class="h-4 w-4" />
    </DsTabsItem>
    <DsTabsItem value="company" label="Company">
      <Building class="h-4 w-4" />
    </DsTabsItem>
    <DsTabsItem value="team" label="Team Members" badge="5">
      <Users class="h-4 w-4" />
    </DsTabsItem>
    <DsTabsItem value="billing" label="Billing" badge="2">
      <CreditCard class="h-4 w-4" />
    </DsTabsItem>
  </DsTabs>
</template>
```

## API Reference

### DsTabs Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelValue` | `string` | `undefined` | Currently active tab value |
| `tabs` | `DsTabItem[]` | `[]` | Array of tab objects (alternative to slot usage) |
| `variant` | `'default' \| 'underlined' \| 'pills' \| 'bordered'` | `'default'` | Visual style variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |
| `fullWidth` | `boolean` | `false` | Whether tabs should take full width |
| `justified` | `boolean` | `false` | Whether tabs should be evenly distributed |
| `disabled` | `boolean` | `false` | Whether the entire tab group is disabled |
| `mobileBreakpoint` | `'sm' \| 'md' \| 'lg'` | `'sm'` | Breakpoint for mobile/desktop switch |

### DsTabsItem Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | **required** | Unique identifier for this tab |
| `label` | `string` | **required** | Display text for the tab |
| `href` | `string` | `undefined` | Optional URL for navigation |
| `disabled` | `boolean` | `false` | Whether this tab is disabled |
| `badge` | `string \| number` | `undefined` | Optional badge content |

## Design Variants

### Default
- **Style**: Rounded tabs with muted background for active state
- **Use case**: General purpose, content switching within a page

### Underlined
- **Style**: Bottom border for active tab, minimal background
- **Use case**: Navigation, page sections, clean design

### Pills
- **Style**: Fully rounded tabs with solid background for active state
- **Use case**: Compact spaces, filter controls, toggles

### Bordered
- **Style**: Bordered container with subtle active state styling
- **Use case**: Form sections, settings panels, contained contexts

## Responsive Behavior

The component automatically adapts to different screen sizes:

### Mobile (below breakpoint)
- Shows a native select dropdown
- Includes ChevronDown icon
- Full touch accessibility
- Shows badges in option text

### Desktop (above breakpoint)
- Shows horizontal tab navigation
- Full keyboard navigation support
- Hover states and focus indicators
- Visual badges and icons

## Accessibility Features

### Keyboard Navigation
- **Tab**: Move focus in/out of tab group
- **Enter/Space**: Activate focused tab

### Screen Reader Support
- Proper `role="tablist"` and `role="tab"` attributes
- `aria-selected` state management
- `aria-current="page"` for navigation links
- Descriptive labels and announcements

### Focus Management
- Visible focus indicators
- Proper tab order
- Focus restoration on tab activation
- Disabled state handling

## Integration Examples

### Server Management Tabs

```html
<script setup>
import { DsTabs, DsTabsItem } from '@/components/ui/ds-tabs'
import { Server, Activity, Settings, Users } from 'lucide-vue-next'

const activeTab = ref('overview')
</script>

<template>
  <DsTabs v-model="activeTab" variant="underlined" class="mb-6">
    <DsTabsItem value="overview" label="Overview">
      <Server class="h-4 w-4" />
    </DsTabsItem>
    <DsTabsItem value="activity" label="Activity" badge="3">
      <Activity class="h-4 w-4" />
    </DsTabsItem>
    <DsTabsItem value="settings" label="Settings">
      <Settings class="h-4 w-4" />
    </DsTabsItem>
    <DsTabsItem value="access" label="Access Control">
      <Users class="h-4 w-4" />
    </DsTabsItem>
  </DsTabs>
</template>
```

### With Navigation Links

```html
<script setup>
const tabs = [
  { value: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { value: 'servers', label: 'Servers', href: '/servers' },
  { value: 'deployments', label: 'Deployments', href: '/deployments' }
]
</script>

<template>
  <DsTabs :tabs="tabs" variant="underlined" />
</template>
```

## Best Practices

1. **Consistent Labeling**: Use clear, concise labels that describe the tab content
2. **Appropriate Variants**: Choose variants that match your design context
3. **Badge Usage**: Use badges sparingly for important notifications or counts
4. **Responsive Design**: Test on mobile devices to ensure dropdown works well
5. **Accessibility**: Always test with keyboard navigation and screen readers
6. **Performance**: For many tabs, consider pagination or grouping

## Troubleshooting

### Common Issues

**Tabs not switching on mobile:**
- Ensure `v-model` is properly bound
- Check that tab values are unique
- Verify mobile breakpoint setting

**Styling not applied:**
- Confirm all required CSS classes are available
- Check for conflicting global styles
- Ensure design tokens are properly configured

**Accessibility issues:**
- Use proper ARIA attributes
- Test keyboard navigation
- Ensure sufficient color contrast
- Provide meaningful labels

This component provides a comprehensive, accessible, and flexible tab solution that integrates seamlessly with the DeployStack design system and development patterns.
