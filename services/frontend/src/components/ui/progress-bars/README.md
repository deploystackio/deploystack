# Progress Bars Component

A multi-step progress indicator component that shows current progress through a series of steps with labels and completion states. Built following shadcn/vue design principles with full customization and accessibility support.

## Features

- Multi-step progress visualization
- Customizable variants (default, success, warning, destructive)
- Multiple sizes (sm, md, lg)
- Interactive step navigation (optional)
- Mobile-responsive design
- Full keyboard accessibility
- Smooth animations and transitions
- TypeScript support

## Usage

### Basic Usage

```html
<script setup>
import { ProgressBars } from '@/components/ui/progress-bars'

const deploymentSteps = [
  { id: 'copy', label: 'Copying files', status: 'completed' },
  { id: 'migrate', label: 'Migrating database', status: 'current' },
  { id: 'compile', label: 'Compiling assets', status: 'pending' },
  { id: 'deploy', label: 'Deployed', status: 'pending' }
]
</script>

<template>
  <ProgressBars
    :steps="deploymentSteps"
    :progress="37.5"
    title="Migrating MySQL database..."
  />
</template>
```

### Interactive Steps

```html
<script setup>
import { ProgressBars } from '@/components/ui/progress-bars'

const steps = [
  { id: 'step1', label: 'Setup', status: 'completed', clickable: true },
  { id: 'step2', label: 'Configuration', status: 'current', clickable: true },
  { id: 'step3', label: 'Review', status: 'pending', clickable: false },
  { id: 'step4', label: 'Deploy', status: 'pending', clickable: false }
]

function handleStepClick(step, index) {
  console.log('Clicked step:', step.label, 'at index:', index)
  // Navigate to specific step
}
</script>

<template>
  <ProgressBars
    :steps="steps"
    :progress="50"
    title="Deployment Setup"
    interactive
    @step-click="handleStepClick"
  />
</template>
```

### Variants and Sizes

```html
<template>
  <!-- Success variant -->
  <ProgressBars
    :steps="completedSteps"
    :progress="100"
    variant="success"
    title="Deployment completed successfully!"
  />

  <!-- Warning variant -->
  <ProgressBars
    :steps="warningSteps"
    :progress="75"
    variant="warning"
    size="lg"
    title="Deployment completed with warnings"
  />

  <!-- Error variant -->
  <ProgressBars
    :steps="errorSteps"
    :progress="25"
    variant="destructive"
    title="Deployment failed"
  />

  <!-- Small size without steps -->
  <ProgressBars
    :steps="[]"
    :progress="60"
    size="sm"
    title="Loading..."
    :show-steps="false"
  />
</template>
```

## API Reference

### ProgressBars Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `steps` | `ProgressStep[]` | `[]` | Array of step objects |
| `progress` | `number` | `0` | Current progress percentage (0-100) |
| `title` | `string` | `''` | Main title/description |
| `variant` | `'default' \| 'success' \| 'warning' \| 'destructive'` | `'default'` | Visual style variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size of progress bar |
| `showSteps` | `boolean` | `true` | Whether to show step labels |
| `hideTitle` | `boolean` | `false` | Hide title visually (keeps for screen readers) |
| `interactive` | `boolean` | `false` | Enable step click interactions |
| `styled` | `boolean` | `false` | Add styled container with background and padding |

### ProgressStep Interface

```typescript
interface ProgressStep {
  id: string                                    // Unique identifier
  label: string                                // Display label
  status: 'completed' | 'current' | 'pending' | 'error'  // Step status
  clickable?: boolean                          // Whether step is clickable (requires interactive=true)
}
```

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `stepClick` | `(step: ProgressStep, index: number)` | Emitted when a step is clicked (requires interactive=true) |

## Design Variants

### Default Theme
- **Background**: Uses `bg-secondary` for track, `bg-primary` for fill
- **Text**: Uses `text-foreground` for title, `text-primary` for active steps
- **Steps**: Completed and current steps use primary color

### Success Theme
- **Background**: Light green track with green-600 fill
- **Use case**: Completed processes, successful deployments

### Warning Theme
- **Background**: Light yellow track with yellow-600 fill
- **Use case**: Processes with warnings, partial completions

### Destructive Theme
- **Background**: Light red track with red-600 fill
- **Use case**: Failed processes, error states

## Responsive Behavior

- **Desktop**: Steps displayed in horizontal grid layout
- **Mobile**: Steps displayed as vertical list with status indicators
- **Grid**: Automatically adjusts column count based on step count (max 6 columns)

## Accessibility Features

- **ARIA**: Proper `progressbar` role with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- **Screen Readers**: Hidden titles with `sr-only` class when needed
- **Keyboard**: Interactive steps support keyboard navigation
- **Focus**: Proper focus management for clickable steps
- **Color**: Status communicated through text and icons, not color alone

## Animation

- **Progress Fill**: Smooth 500ms ease-out transition
- **Step Colors**: 200ms color transitions
- **Current Step**: Subtle pulse animation for active step indicator

## Examples

### Deployment Progress
```html
<ProgressBars
  :steps="[
    { id: 'validate', label: 'Validating', status: 'completed' },
    { id: 'build', label: 'Building', status: 'completed' },
    { id: 'deploy', label: 'Deploying', status: 'current' },
    { id: 'verify', label: 'Verifying', status: 'pending' }
  ]"
  :progress="75"
  title="Deploying to production..."
  variant="default"
/>
```

### Form Wizard
```html
<ProgressBars
  :steps="[
    { id: 'basic', label: 'Basic Info', status: 'completed', clickable: true },
    { id: 'config', label: 'Configuration', status: 'current', clickable: true },
    { id: 'review', label: 'Review', status: 'pending', clickable: false },
    { id: 'complete', label: 'Complete', status: 'pending', clickable: false }
  ]"
  :progress="50"
  title="Server Setup Wizard"
  interactive
  @step-click="navigateToStep"
/>
```

### File Upload

```html
<ProgressBars
  :steps="[]"
  :progress="uploadProgress"
  :title="`Uploading ${fileName}...`"
  size="sm"
  :show-steps="false"
  variant="default"
/>
```

## Integration with DeployStack

This component is designed to integrate seamlessly with DeployStack's deployment processes, server management workflows, and multi-step forms. It follows the established design system patterns and can be used throughout the application for consistent progress indication.
