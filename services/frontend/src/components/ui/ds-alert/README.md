# DS Alert Component

A customizable alert component for DeployStack with multiple variants, optional icons, title, and description. Built following shadcn/vue design principles with full customization and accessibility support.

## Features

- Multiple alert variants (default, success, warning, error, info)
- Optional default icons for each variant
- Flexible title and description support
- Dismissible alerts with close button
- Multiple sizes (sm, md, lg)
- Dark mode support
- Full keyboard accessibility
- TypeScript support
- Composable with slot-based architecture

## Usage

### Basic Usage

```html
<script setup>
import { DsAlert } from '@/components/ui/ds-alert'
</script>

<template>
  <!-- Simple success alert -->
  <DsAlert
    variant="success"
    title="Success!"
    description="Your changes have been saved successfully."
  />

  <!-- Warning alert without title -->
  <DsAlert
    variant="warning"
    description="Please review your settings before continuing."
  />

  <!-- Error alert without icon -->
  <DsAlert
    variant="error"
    title="Error"
    description="Something went wrong. Please try again."
    :show-icon="false"
  />
</template>
```

### Slot-based Usage

```html
<script setup>
import { DsAlert, DsAlertTitle, DsAlertDescription } from '@/components/ui/ds-alert'
</script>

<template>
  <!-- Custom content with slots -->
  <DsAlert variant="info">
    <DsAlertTitle>Update Available</DsAlertTitle>
    <DsAlertDescription>
      A new version of the server is available. 
      <a href="#" class="underline hover:no-underline">
        Learn more
      </a>
    </DsAlertDescription>
  </DsAlert>

  <!-- Custom icon -->
  <DsAlert variant="warning">
    <template #icon>
      <Zap class="h-4 w-4 text-yellow-600" />
    </template>
    <DsAlertTitle>High Resource Usage</DsAlertTitle>
    <DsAlertDescription>
      Your deployment is using more resources than expected.
    </DsAlertDescription>
  </DsAlert>
</template>
```

### Dismissible Alerts

```html
<script setup>
import { ref } from 'vue'
import { DsAlert } from '@/components/ui/ds-alert'

const showAlert = ref(true)

function handleDismiss() {
  showAlert.value = false
}
</script>

<template>
  <DsAlert
    v-if="showAlert"
    variant="success"
    title="Deployment Complete"
    description="Your MCP server has been deployed successfully."
    dismissible
    @dismiss="handleDismiss"
  />
</template>
```

### Different Sizes

```html
<template>
  <!-- Small alert -->
  <DsAlert
    variant="info"
    size="sm"
    description="This is a small alert."
  />

  <!-- Medium alert (default) -->
  <DsAlert
    variant="warning"
    title="Medium Alert"
    description="This is the default medium size."
  />

  <!-- Large alert -->
  <DsAlert
    variant="error"
    size="lg"
    title="Large Alert"
    description="This is a large alert with more prominent styling."
  />
</template>
```

## API Reference

### DsAlert Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'success' \| 'warning' \| 'error' \| 'info'` | `'default'` | Visual style variant |
| `title` | `string` | `undefined` | Optional title text |
| `description` | `string` | `undefined` | Optional description text |
| `showIcon` | `boolean` | `true` | Whether to show the default variant icon |
| `dismissible` | `boolean` | `false` | Whether to show a close button |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size variant |

### DsAlert Slots

| Slot | Description |
|------|-------------|
| `default` | Main content area (used when no title/description props) |
| `title` | Custom title content (overrides title prop) |
| `description` | Custom description content (overrides description prop) |
| `icon` | Custom icon (overrides default variant icon) |

### DsAlert Events

| Event | Payload | Description |
|-------|---------|-------------|
| `dismiss` | `void` | Emitted when the close button is clicked |

### DsAlertTitle Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | `undefined` | Additional CSS classes |

### DsAlertDescription Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `class` | `string` | `undefined` | Additional CSS classes |

## Design Variants

### Default
- **Background**: Uses card background with standard border
- **Icon**: AlertCircle in muted color
- **Use case**: General information, neutral notifications

### Success
- **Background**: Light green with green border
- **Icon**: CheckCircle in green
- **Use case**: Successful operations, confirmations, completed tasks

### Warning
- **Background**: Light yellow with yellow border
- **Icon**: AlertTriangle in yellow
- **Use case**: Cautions, non-critical issues, important notices

### Error
- **Background**: Light red with red border
- **Icon**: XCircle in red
- **Use case**: Errors, failures, critical issues requiring attention

### Info
- **Background**: Light blue with blue border
- **Icon**: Info in blue
- **Use case**: Helpful information, tips, additional context

## Accessibility Features

- **ARIA**: Proper `alert` role for screen readers
- **Keyboard**: Close button supports keyboard navigation
- **Focus**: Proper focus management with visible focus indicators
- **Screen Readers**: Meaningful labels and descriptions
- **Color Independence**: Information conveyed through icons and text, not color alone

## Dark Mode Support

All variants include dark mode variants with appropriate contrast ratios:
- Darker backgrounds with lighter text
- Adjusted border colors for better visibility
- Icon colors optimized for dark themes

## Integration Guidelines

### With DeployStack Workflows

```html
<!-- Server deployment success -->
<DsAlert
  variant="success"
  title="Server Deployed"
  description="Your MCP server is now running and available for connections."
  dismissible
/>

<!-- Configuration warning -->
<DsAlert
  variant="warning"
  title="Configuration Issue"
  description="Some environment variables are missing. The server may not function correctly."
/>

<!-- Deployment error -->
<DsAlert
  variant="error"
  title="Deployment Failed"
  description="Unable to deploy server. Check your configuration and try again."
/>
```

### In Form Validation

```html
<!-- Field validation error -->
<DsAlert
  variant="error"
  size="sm"
  description="Please enter a valid GitHub repository URL."
  :show-icon="false"
/>

<!-- Form submission success -->
<DsAlert
  variant="success"
  title="Changes Saved"
  description="Your MCP server configuration has been updated."
  dismissible
/>
```

### System Notifications

```html
<!-- Update notification -->
<DsAlert variant="info" dismissible>
  <DsAlertTitle>System Update</DsAlertTitle>
  <DsAlertDescription>
    A new version is available. 
    <Button variant="link" class="p-0 h-auto text-blue-600 underline">
      Update now
    </Button>
  </DsAlertDescription>
</DsAlert>
```

## Examples

### Complete Usage Examples

```html
<script setup>
import { ref } from 'vue'
import { DsAlert, DsAlertTitle, DsAlertDescription } from '@/components/ui/ds-alert'
import { Button } from '@/components/ui/button'

const showSuccessAlert = ref(false)
const showWarningAlert = ref(true)

function handleDeploymentComplete() {
  showSuccessAlert.value = true
}
</script>

<template>
  <div class="space-y-4">
    <!-- Success notification -->
    <DsAlert
      v-if="showSuccessAlert"
      variant="success"
      title="MCP Server Updated"
      description="Your changes have been applied successfully."
      dismissible
      @dismiss="showSuccessAlert = false"
    />

    <!-- Warning with custom content -->
    <DsAlert v-if="showWarningAlert" variant="warning" dismissible @dismiss="showWarningAlert = false">
      <DsAlertTitle>Resource Limits</DsAlertTitle>
      <DsAlertDescription>
        Your deployment is approaching resource limits. Consider upgrading your plan or 
        <Button variant="link" class="p-0 h-auto underline">
          optimize your configuration
        </Button>.
      </DsAlertDescription>
    </DsAlert>

    <!-- Info alert with custom icon -->
    <DsAlert variant="info">
      <template #icon>
        <Lightbulb class="h-4 w-4 text-blue-600" />
      </template>
      <DsAlertTitle>Pro Tip</DsAlertTitle>
      <DsAlertDescription>
        Use environment variables to configure your MCP server for different environments.
      </DsAlertDescription>
    </DsAlert>

    <!-- Error alert without icon -->
    <DsAlert
      variant="error"
      title="Connection Failed"
      description="Unable to connect to the MCP server. Please check your network connection."
      :show-icon="false"
    />
  </div>
</template>
```

## Best Practices

1. **Use appropriate variants**: Choose the variant that best matches the semantic meaning of your message
2. **Keep messages concise**: Alert descriptions should be brief and actionable
3. **Provide dismissibility**: For non-critical alerts, allow users to dismiss them
4. **Use consistent sizing**: Stick to medium size for most alerts, small for inline validation, large for important system messages
5. **Don't overuse**: Too many alerts can overwhelm users and reduce their effectiveness
6. **Make them actionable**: When possible, provide next steps or actions users can take

This component integrates seamlessly with the DeployStack design system and provides a consistent, accessible way to communicate important information to users throughout the application.
