# DsProgressSteps Component

A vertical progress step indicator for multi-step workflows with support for completed, active, and pending states.

## Features

- Three step states: completed, active, pending
- White icon on gray-600 circular background for active step
- Green checkmark for completed steps
- Gray background for pending steps (matching sidebar)
- White panel for active step with content slot
- Center-aligned layout
- Fully responsive
- Dark mode support

## Usage

### Basic Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DsProgressSteps, type ProgressStep } from '@/components/ui/ds-progress-steps'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const currentStep = ref(1)
const completedSteps = ref<number[]>([0])

const steps: ProgressStep[] = [
  {
    id: 'install',
    title: 'Install dependencies',
    description: 'Installing required packages'
  },
  {
    id: 'create-proxy',
    title: 'Create an MCP Proxy Server',
    description: 'Configure your proxy settings'
  },
  {
    id: 'add-server',
    title: 'Add your first MCP server',
    description: 'Connect to your MCP server'
  }
]

const proxyName = ref('')

function createProxy() {
  if (proxyName.value.trim()) {
    completedSteps.value.push(1)
    currentStep.value = 2
  }
}
</script>

<template>
  <DsProgressSteps
    :steps="steps"
    :current-step="currentStep"
    :completed-steps="completedSteps"
  >
    <!-- Active step content (index 1) -->
    <template #step-content-1>
      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="proxy-name">Name</Label>
          <Input
            id="proxy-name"
            v-model="proxyName"
            placeholder="my-proxy"
          />
        </div>
        <Button @click="createProxy" :disabled="!proxyName.trim()">
          Create proxy
        </Button>
      </div>
    </template>

    <!-- Active step content (index 2) if needed -->
    <template #step-content-2>
      <div class="space-y-4">
        <!-- Your form for adding MCP server -->
      </div>
    </template>
  </DsProgressSteps>
</template>
```

### Step States

The component automatically determines step states:

1. **Completed**: Steps in the `completedSteps` array
   - Green background (`bg-green-50`)
   - Green checkmark icon
   - Green text

2. **Active**: Step matching `currentStep` index
   - White background (`bg-white`)
   - White dashed circle icon on gray-600 circular background
   - Dark text
   - Shows slot content if provided

3. **Pending**: All other steps
   - Gray background (`bg-[#F6F6F6]`) matching sidebar
   - Gray circle icon
   - Muted text

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `steps` | `ProgressStep[]` | Yes | - | Array of step definitions |
| `currentStep` | `number` | Yes | - | Index of currently active step |
| `completedSteps` | `number[]` | No | `[]` | Array of completed step indices |

### ProgressStep Interface

```typescript
interface ProgressStep {
  id: string | number
  title: string
  description?: string
}
```

### Slots

Dynamic slots for step content:
- `step-content-{index}` - Content shown when step is active

Example:
```vue
<template #step-content-0>
  <!-- Content for first step (index 0) -->
</template>

<template #step-content-1>
  <!-- Content for second step (index 1) -->
</template>
```

## Styling

The component uses:
- Tailwind CSS classes
- shadcn/vue design tokens
- Gray-600 circular background for active step icon
- Smooth transitions between states

## Accessibility

- Semantic HTML structure
- Clear visual state indicators
- Proper color contrast (WCAG compliant)
- Icon + text labels for all states

## Example Workflow

```vue
<script setup lang="ts">
const currentStep = ref(0)
const completedSteps = ref<number[]>([])

function completeCurrentStep() {
  completedSteps.value.push(currentStep.value)
  currentStep.value++
}

function goToPreviousStep() {
  if (currentStep.value > 0) {
    currentStep.value--
    completedSteps.value = completedSteps.value.filter(
      step => step < currentStep.value
    )
  }
}
</script>

<template>
  <DsProgressSteps
    :steps="steps"
    :current-step="currentStep"
    :completed-steps="completedSteps"
  >
    <template #step-content-0>
      <Button @click="completeCurrentStep">Next Step</Button>
    </template>

    <template #step-content-1>
      <div class="flex gap-2">
        <Button variant="outline" @click="goToPreviousStep">Back</Button>
        <Button @click="completeCurrentStep">Next Step</Button>
      </div>
    </template>
  </DsProgressSteps>
</template>
```

## Notes

- Step indices are zero-based (0, 1, 2...)
- Only the active step shows slot content
- All steps are always visible
- Component is center-aligned with max width of 2xl
- Responsive padding and spacing
