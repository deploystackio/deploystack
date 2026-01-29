# DsProgressSteps Component

A vertical collapsible progress step indicator for multi-step workflows with support for completed, active, loading, and pending states.

## Component Structure

The DsProgressSteps component is composed of three modular components:

- **DsProgressSteps.vue** - Main orchestrator component
- **DsProgressStepsHeader.vue** - Individual step header with icon, title, and chevron
- **DsProgressStepsFooter.vue** - Navigation footer with Back/Next buttons

All components can be imported individually if needed:

```typescript
import {
  DsProgressSteps,
  DsProgressStepsHeader,
  DsProgressStepsFooter,
  type ProgressStep
} from '@/components/ui/ds-progress-steps'
```

## Features

- **Four step states**: completed, active, loading, pending
- **Collapsible steps**: Each step can be expanded/collapsed independently
- **Smart interactions**: Only completed and current steps are clickable
- **Built-in footer**: Optional Back/Next buttons with consistent styling
- **Loading state**: Animated spinner for steps waiting for async operations
- **Smart border rounding**: First/last steps have rounded corners
- **Multiple steps open**: Users can expand multiple completed steps simultaneously
- **Auto-collapse**: Completed steps auto-collapse when moving to next step
- **White background**: Active and completed steps use white background
- **Dark mode support**: Full dark mode compatibility

## Usage

### Basic Example with Footer

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DsProgressSteps, type ProgressStep } from '@/components/ui/ds-progress-steps'

const currentStep = ref(0)
const completedSteps = ref<number[]>([])
const loadingSteps = ref<number[]>([])

const steps: ProgressStep[] = [
  {
    id: 'install',
    title: 'Install dependencies',
    description: 'Installing required packages'
  },
  {
    id: 'configure',
    title: 'Configure settings',
    description: 'Configure your application'
  },
  {
    id: 'deploy',
    title: 'Deploy application',
    description: 'Deploy to production'
  }
]

function handleNext() {
  completedSteps.value.push(currentStep.value)
  currentStep.value++
}

function handleBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}
</script>

<template>
  <DsProgressSteps
    :steps="steps"
    :current-step="currentStep"
    :completed-steps="completedSteps"
    :loading-steps="loadingSteps"
    :show-back-button="currentStep > 0"
    next-button-text="Continue"
    @next="handleNext"
    @back="handleBack"
  >
    <template #step-content-0>
      <div class="space-y-4">
        <p>Install your dependencies here...</p>
      </div>
    </template>

    <template #step-content-1>
      <div class="space-y-4">
        <p>Configure your settings here...</p>
      </div>
    </template>

    <template #step-content-2>
      <div class="space-y-4">
        <p>Deploy your application here...</p>
      </div>
    </template>
  </DsProgressSteps>
</template>
```

### Step States

The component automatically determines step states:

1. **Loading**: Steps in the `loadingSteps` array (highest priority)
   - White background (`bg-white`)
   - Animated spinner icon (primary color)
   - Dark text
   - Indicates step is processing/waiting

2. **Completed**: Steps in the `completedSteps` array
   - White background (`bg-white`)
   - Green checkmark icon (`bg-green-600`)
   - Collapsible and can be reopened by user

3. **Active**: Step matching `currentStep` index
   - White background (`bg-white`)
   - Amber loader icon (`text-amber-600`) - static, no animation
   - Dark text
   - Collapsible
   - Shows slot content when expanded

4. **Pending**: All other steps (future steps)
   - Gray background (`bg-neutral-50`)
   - Gray circle icon
   - Muted text
   - Not clickable - no chevron shown

### Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `steps` | `ProgressStep[]` | Yes | - | Array of step definitions |
| `currentStep` | `number` | Yes | - | Index of currently active step |
| `completedSteps` | `number[]` | No | `[]` | Array of completed step indices |
| `loadingSteps` | `number[]` | No | `[]` | Array of loading step indices |
| `maxWidth` | `string` | No | `'max-w-2xl'` | Maximum width class |
| `showBackButton` | `boolean` | No | `false` | Show back button in footer |
| `backButtonText` | `string` | No | `'Back'` | Text for back button |
| `backButtonTo` | `RouteLocationRaw` | No | - | Vue Router location for back button navigation (replaces click handler) |
| `nextButtonText` | `string` | No | `'Next'` | Text for next button |
| `isNextDisabled` | `boolean` | No | `false` | Disable the next button |
| `isProcessComplete` | `boolean` | No | `false` | Lock all steps and hide footer when process is done |
| `hideFooter` | `boolean` | No | `false` | Completely hide the built-in footer (use when steps manage their own navigation) |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `@next` | - | Emitted when next button is clicked |
| `@back` | - | Emitted when back button is clicked (not emitted if `backButtonTo` is provided) |

### ProgressStep Interface

```typescript
interface ProgressStep {
  id: string | number
  title: string
  description?: string
}
```

### Slots

Dynamic slots for step content and footers:
- `step-content-{index}` - Content shown when step is expanded (wrapped in padding)
- `step-footer-{index}` - Optional custom footer for each step (renders outside padding)

Example:
```vue
<!-- Step content (will be wrapped in p-6 pt-4 padding) -->
<template #step-content-0>
  <div class="space-y-4">
    <p>Your form fields and content here...</p>
  </div>
</template>

<!-- Custom footer (renders outside padding with gray background) -->
<template #step-footer-0>
  <DsProgressStepsFooter
    next-button-text="Continue"
    :is-next-disabled="!isValid"
    @next="handleNext"
  />
</template>
```

## Collapsible Behavior

### User Interactions
- **Clickable**: Completed steps and current step can be toggled
- **Non-clickable**: Pending/future steps cannot be opened
- **Chevron indicator**: Only shown for clickable steps
- **Multiple open**: Users can have multiple steps expanded at once

### Auto-collapse
- When a step is completed and user moves to next step, the completed step auto-collapses
- Users can manually reopen any completed step by clicking the header

## Footer System

The component supports two footer approaches:

### 1. Built-in Footer (Default)
The built-in footer is automatically rendered when `hideFooter` is not set:
- **Gray background** (`bg-neutral-50`) matching DsCard footer design
- **Top border** (`border-t`) for visual separation
- **Back button** (left) - Hidden by default, show with `showBackButton={true}`
- **Next button** (right) - Primary variant, customizable via props
- **Edge-to-edge** - Extends full width with no padding around it
- **Process completion** - Footer is hidden when `isProcessComplete={true}`

### 2. Custom Footer Slots (Advanced)
Use `step-footer-{index}` slots for per-step custom footers when `hideFooter={true}`:
- Renders **outside** the padded content area
- Matches DsCard footer design (gray background, top border)
- Full control over button text, loading states, and styling
- Ideal for multi-step wizards with varying button labels per step

### Footer Examples

```vue
<!-- Hide back button on first step -->
<DsProgressSteps
  :show-back-button="currentStep > 0"
  @next="handleNext"
  @back="handleBack"
/>

<!-- Custom button text -->
<DsProgressSteps
  back-button-text="Previous"
  next-button-text="Continue"
/>

<!-- Back button with router-link navigation -->
<DsProgressSteps
  :show-back-button="true"
  back-button-text="Return to Dashboard"
  :back-button-to="{ name: 'Dashboard' }"
/>

<!-- Back button with string path -->
<DsProgressSteps
  :show-back-button="true"
  back-button-text="Back to Catalog"
  back-button-to="/mcp-server/catalog"
/>

<!-- Back button with route params -->
<DsProgressSteps
  :show-back-button="true"
  back-button-text="Back to Team"
  :back-button-to="{ name: 'TeamManage', params: { id: teamId } }"
/>

<!-- Disable next until validation passes -->
<DsProgressSteps
  :is-next-disabled="!isFormValid"
/>

<!-- Lock all interactions when process complete -->
<DsProgressSteps
  :is-process-complete="isComplete"
/>

<!-- Hide footer when steps manage their own navigation -->
<DsProgressSteps
  :hide-footer="true"
>
  <template #step-content-0>
    <MyStepComponent @next="handleNext" @back="handleBack" />
    <!-- MyStepComponent includes its own footer buttons -->
  </template>
</DsProgressSteps>
```

### Custom Footer Slots Example

Use custom footer slots when you need different button text, loading states, or styling per step:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DsProgressSteps, DsProgressStepsFooter, type ProgressStep } from '@/components/ui/ds-progress-steps'

const currentStep = ref(0)
const isDeploying = ref(false)

const steps: ProgressStep[] = [
  { id: 1, title: 'Select Repository' },
  { id: 2, title: 'Configure Environment' },
  { id: 3, title: 'Deploy' }
]

async function handleDeploy() {
  isDeploying.value = true
  await deployToProduction()
  isDeploying.value = false
  currentStep.value++
}
</script>

<template>
  <DsProgressSteps
    :steps="steps"
    :current-step="currentStep"
    :hide-footer="true"
  >
    <!-- Step 1: Regular Next button -->
    <template #step-content-0>
      <div class="space-y-4">
        <p>Select your repository...</p>
      </div>
    </template>

    <template #step-footer-0>
      <DsProgressStepsFooter
        next-button-text="Next"
        @next="currentStep++"
      />
    </template>

    <!-- Step 2: Custom "Deploy" button with loading state -->
    <template #step-content-1>
      <div class="space-y-4">
        <p>Configure environment variables...</p>
      </div>
    </template>

    <template #step-footer-1>
      <DsProgressStepsFooter
        next-button-text="Deploy"
        :is-next-loading="isDeploying"
        next-loading-text="Deploying..."
        next-button-class="bg-green-600 hover:bg-green-700 text-white"
        @next="handleDeploy"
      />
    </template>

    <!-- Step 3: Success screen with custom action -->
    <template #step-content-2>
      <div class="text-center">
        <h3>Deployment successful!</h3>
      </div>
    </template>

    <template #step-footer-2>
      <DsProgressStepsFooter
        next-button-text="View Installation"
        @next="navigateToInstallation"
      />
    </template>
  </DsProgressSteps>
</template>
```

### When to Use Custom Footer Slots

Use `hideFooter={true}` with custom `step-footer-{index}` slots when:
- **Different button text per step** (e.g., "Next", "Deploy", "Finish")
- **Loading states** needed for async operations (e.g., "Deploying..." while waiting)
- **Custom button styling** per step (e.g., green "Deploy" button, default "Next" button)
- **Conditional footer visibility** (e.g., only show footer when data is loaded)
- **Per-step validation** that affects button disabled states

When using custom footers:
- Set `:hide-footer="true"` on `DsProgressSteps`
- Provide `step-footer-{index}` slot for each step that needs a footer
- Use `DsProgressStepsFooter` component for consistent styling
- Footer renders outside padded content with gray background (matches DsCard design)
```

## Loading State Example

```vue
<script setup lang="ts">
const loadingSteps = ref<number[]>([])

async function deployApplication() {
  // Mark step as loading
  loadingSteps.value.push(2)

  try {
    await someAsyncOperation()

    // Remove loading state
    loadingSteps.value = loadingSteps.value.filter(s => s !== 2)

    // Mark as completed
    completedSteps.value.push(2)
    currentStep.value++
  } catch (error) {
    loadingSteps.value = loadingSteps.value.filter(s => s !== 2)
  }
}
</script>
```

## Smart Border Strategy

### Border Application
To prevent double borders where step items meet, the component uses a smart border strategy:

- **Single step**: Border on all sides (`border`)
- **First step**: Border on all sides (`border`) - provides top border for the stack
- **Middle/Last steps**: Border on left, right, and bottom only (`border-x border-b`) - no top border to avoid doubling

This creates clean, single-pixel border lines between stacked items.

### Border Rounding

- **Single step**: All corners rounded (`rounded-lg`)
- **First step**: Top corners rounded (`rounded-t-lg`)
- **Last step**: Bottom corners rounded (`rounded-b-lg`)
- **Middle steps**: No rounding (creates unified card appearance)

## Styling

The component uses:
- Tailwind CSS classes with `neutral` color palette
- shadcn/vue Button component for footer
- Lucide icons: `Check`, `Circle`, `Loader`, `ChevronDown`
- Spinner component for animated loading state
- Smooth transitions for chevron rotation and state changes

## Accessibility

- **Semantic HTML**: Proper button elements for clickable headers
- **Disabled states**: Non-clickable steps use `:disabled` attribute
- **Focus management**: Focus outlines removed for cleaner appearance
- **Clear visual indicators**: Different icons and colors for each state
- **WCAG compliant**: Proper color contrast in light and dark modes

## Complete Workflow Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { DsProgressSteps, type ProgressStep } from '@/components/ui/ds-progress-steps'

const currentStep = ref(0)
const completedSteps = ref<number[]>([])
const loadingSteps = ref<number[]>([])
const isFormValid = ref(false)

const steps: ProgressStep[] = [
  { id: 1, title: 'Personal Information' },
  { id: 2, title: 'Confirm Details' },
  { id: 3, title: 'Success' }
]

function handleNext() {
  // Validate current step
  if (!isFormValid.value) return

  // Mark current as completed
  completedSteps.value.push(currentStep.value)

  // Move to next step
  currentStep.value++
}

function handleBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}
</script>

<template>
  <DsProgressSteps
    :steps="steps"
    :current-step="currentStep"
    :completed-steps="completedSteps"
    :loading-steps="loadingSteps"
    :show-back-button="currentStep > 0"
    :is-next-disabled="!isFormValid"
    :next-button-text="currentStep === steps.length - 1 ? 'Finish' : 'Continue'"
    @next="handleNext"
    @back="handleBack"
  >
    <template #step-content-0>
      <div class="space-y-4">
        <input v-model="formData" @input="validateForm" />
      </div>
    </template>

    <template #step-content-1>
      <div class="space-y-4">
        <p>Review your information...</p>
      </div>
    </template>

    <template #step-content-2>
      <div class="text-center">
        <h3 class="text-xl font-bold">Success!</h3>
        <p>Your submission is complete.</p>
      </div>
    </template>
  </DsProgressSteps>
</template>
```

## Individual Components

### DsProgressStepsHeader

The header component can be used independently for custom step implementations:

```vue
<DsProgressStepsHeader
  :icon="CheckIcon"
  icon-classes="text-green-600"
  title="Step Title"
  description="Step description"
  text-classes="text-zinc-900"
  :is-expanded="true"
  :can-toggle="true"
  :is-process-complete="false"
  @toggle="handleToggle"
/>
```

**Props:**
- `icon` (Component) - Icon component to display
- `iconClasses` (string) - CSS classes for icon styling
- `title` (string) - Step title text
- `description` (string, optional) - Step description
- `textClasses` (string) - CSS classes for title text
- `isExpanded` (boolean) - Whether step is expanded
- `canToggle` (boolean) - Whether step can be toggled
- `isProcessComplete` (boolean) - Locks interaction when true

**Events:**
- `@toggle` - Emitted when header is clicked

### DsProgressStepsFooter

The footer component can be used independently for custom navigation. It features a gray background with top border, matching the DsCard footer design.

```vue
<!-- Basic usage with click handlers -->
<DsProgressStepsFooter
  :show-back-button="true"
  back-button-text="Previous"
  next-button-text="Continue"
  :is-next-disabled="false"
  :is-next-loading="false"
  next-loading-text="Processing..."
  next-button-variant="default"
  next-button-class="bg-green-600 hover:bg-green-700 text-white"
  :is-process-complete="false"
  @back="handleBack"
  @next="handleNext"
/>

<!-- Back button with router-link (no @back event needed) -->
<DsProgressStepsFooter
  :show-back-button="true"
  back-button-text="Return to Dashboard"
  :back-button-to="{ name: 'Dashboard' }"
  next-button-text="Continue"
  @next="handleNext"
/>
```

**Props:**
- `showBackButton` (boolean, default: `false`) - Show/hide back button
- `backButtonText` (string, default: `'Back'`) - Back button label
- `backButtonTo` (RouteLocationRaw, optional) - Vue Router location for back button navigation. When provided, renders as router-link instead of emitting @back event
- `nextButtonText` (string, default: `'Next'`) - Next button label
- `isNextDisabled` (boolean, default: `false`) - Disable next button
- `isNextLoading` (boolean, default: `false`) - Show loading state on next button
- `nextLoadingText` (string, optional) - Text to show when loading
- `nextButtonVariant` (string, default: `'default'`) - Button variant (default, destructive, outline, secondary, ghost, link)
- `nextButtonClass` (string, optional) - Additional CSS classes for next button
- `isProcessComplete` (boolean, default: `false`) - Hide footer when true

**Back Button Behavior:**
- **Without `backButtonTo`**: Emits `@back` event when clicked (requires event handler)
- **With `backButtonTo`**: Renders as `router-link` for direct navigation (no `@back` event emitted)

**Examples:**
```vue
<!-- Click handler approach -->
<DsProgressStepsFooter
  :show-back-button="true"
  back-button-text="Cancel"
  @back="handleCancel"
/>

<!-- Router navigation approach -->
<DsProgressStepsFooter
  :show-back-button="true"
  back-button-text="Back to Catalog"
  back-button-to="/mcp-server/catalog"
/>

<!-- Named route with params -->
<DsProgressStepsFooter
  :show-back-button="true"
  back-button-text="Back to Team"
  :back-button-to="{ name: 'TeamManage', params: { id: teamId } }"
/>
```

**Styling:**
- Gray background: `bg-neutral-50 dark:bg-neutral-800`
- Top border: `border-t border-neutral-200 dark:border-neutral-700`
- Padding: `px-6 py-4`
- Full-width edge-to-edge design

**Events:**
- `@back` - Emitted when back button is clicked (only when `backButtonTo` is not provided)
- `@next` - Emitted when next button is clicked

## Notes

- Step indices are zero-based (0, 1, 2...)
- Steps automatically collapse when completed and user moves forward
- Only completed and current steps can be toggled by clicking
- Footer is automatically included in each step (customize with props)
- Loading state has highest priority in state determination
- Component uses smart border strategy to prevent double borders
- Header and Footer components can be used independently for custom implementations
- Responsive with proper mobile support
