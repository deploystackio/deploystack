# RadioCard Component

A reusable radio button card component for selecting options in a card-style interface with visual feedback.

## Features

- Native radio input wrapped in card styling
- Hover states with subtle background change
- Selected state with highlighted border
- Support for title, description, and custom content slots
- Seamless stacked appearance with smart border strategy (no gaps between cards)
- Rounded corners only on outer edges (first/last cards)
- Dark mode support
- Keyboard accessible
- Group management with `RadioCardGroup`
- Disabled state support

## Component Structure

The RadioCard component consists of two parts:

- **RadioCard** - Individual radio card component
- **RadioCardGroup** - Wrapper for managing a group of radio cards

## Basic Usage

### With RadioCardGroup (Recommended)

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RadioCard, RadioCardGroup } from '@/components/ui/radio-card'

const selectedPlan = ref('pro')
</script>

<template>
  <RadioCardGroup v-model="selectedPlan" name="plan-selection">
    <RadioCard value="free">
      <template #title>Free Plan</template>
      <template #description>
        <span class="text-sm text-muted-foreground">Perfect for getting started</span>
      </template>
    </RadioCard>

    <RadioCard value="pro">
      <template #title>Pro Plan</template>
      <template #description>
        <span class="text-sm text-muted-foreground">For professional users</span>
      </template>
    </RadioCard>

    <RadioCard value="enterprise">
      <template #title>Enterprise Plan</template>
      <template #description>
        <span class="text-sm text-muted-foreground">For large organizations</span>
      </template>
    </RadioCard>
  </RadioCardGroup>
</template>
```

### Standalone RadioCard

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { RadioCard } from '@/components/ui/radio-card'

const selected = ref('option1')
</script>

<template>
  <RadioCard
    v-model="selected"
    value="option1"
    name="standalone-option"
  >
    <template #title>Option 1</template>
    <template #description>
      <span class="text-sm text-muted-foreground">This is option 1</span>
    </template>
  </RadioCard>
</template>
```

## Props

### RadioCard Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `string` | Yes | - | The value of this radio option |
| `modelValue` | `string` | No | - | v-model binding for selected value (when used standalone) |
| `name` | `string` | No | - | Radio input name (auto-provided by RadioCardGroup) |
| `disabled` | `boolean` | No | `false` | Disable this radio card |
| `class` | `string` | No | - | Additional CSS classes |

### RadioCardGroup Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `modelValue` | `string` | Yes | - | v-model binding for selected value |
| `name` | `string` | No | - | Radio group name (shared by all child RadioCards) |
| `disabled` | `boolean` | No | `false` | Disable all radio cards in the group |
| `class` | `string` | No | - | Additional CSS classes |

## Emits

### RadioCard Emits

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `string` | Emitted when the radio selection changes |

### RadioCardGroup Emits

| Event | Payload | Description |
|-------|---------|-------------|
| `update:modelValue` | `string` | Emitted when any child radio selection changes |

## Slots

### RadioCard Slots

| Slot | Description |
|------|-------------|
| `title` | Content for the card title (bold, primary text) |
| `description` | Content for the card description (below title) |
| `default` | Additional content below title and description |

## Examples

### With Custom Content

```vue
<RadioCardGroup v-model="selectedSatellite" name="satellite-selection">
  <RadioCard
    v-for="satellite in satellites"
    :key="satellite.id"
    :value="satellite.id"
  >
    <template #title>{{ satellite.name }}</template>
    <template #description>
      <span class="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
        {{ satellite.type }}
      </span>
    </template>
  </RadioCard>
</RadioCardGroup>
```

### With Disabled State

```vue
<RadioCardGroup v-model="selected" name="options">
  <RadioCard value="option1">
    <template #title>Available Option</template>
  </RadioCard>

  <RadioCard value="option2" :disabled="true">
    <template #title>Disabled Option</template>
    <template #description>
      <span class="text-sm text-muted-foreground">This option is not available</span>
    </template>
  </RadioCard>
</RadioCardGroup>
```

### Disable Entire Group

```vue
<RadioCardGroup v-model="selected" name="options" :disabled="true">
  <RadioCard value="option1">
    <template #title>Option 1</template>
  </RadioCard>
  <RadioCard value="option2">
    <template #title>Option 2</template>
  </RadioCard>
</RadioCardGroup>
```

### With Badges and Icons

```vue
<RadioCardGroup v-model="selected" name="features">
  <RadioCard value="basic">
    <template #title>
      <div class="flex items-center gap-2">
        <Package class="h-4 w-4" />
        Basic Features
      </div>
    </template>
    <template #description>
      <div class="flex gap-2 mt-2">
        <Badge variant="secondary">5 Projects</Badge>
        <Badge variant="secondary">10GB Storage</Badge>
      </div>
    </template>
  </RadioCard>

  <RadioCard value="advanced">
    <template #title>
      <div class="flex items-center gap-2">
        <Zap class="h-4 w-4" />
        Advanced Features
        <Badge variant="default">Popular</Badge>
      </div>
    </template>
    <template #description>
      <div class="flex gap-2 mt-2">
        <Badge variant="secondary">Unlimited Projects</Badge>
        <Badge variant="secondary">100GB Storage</Badge>
      </div>
    </template>
  </RadioCard>
</RadioCardGroup>
```

### Custom Styling

```vue
<RadioCardGroup v-model="selected" name="custom" class="space-y-4">
  <RadioCard value="custom1" class="border-2 p-6">
    <template #title>Custom Styled Card</template>
  </RadioCard>
</RadioCardGroup>
```

## Styling

### Smart Border Strategy

The RadioCard component uses a smart border strategy with 2px borders only on the outer edges:

**Single card:**
- 2px border on all sides (`border-2`)
- All corners rounded (`rounded-lg`)

**First card in group:**
- 2px border on top, left, and right (`border-2 border-b-0`)
- Top corners rounded (`rounded-t-lg`)
- 1px separator line at bottom (added by group)

**Middle cards:**
- 2px border on left and right only (`border-x-2 border-t-0 border-b-0`)
- No rounding (creates unified appearance)
- 1px separator line at bottom (added by group)

**Last card in group:**
- 2px border on bottom, left, and right (`border-2 border-t-0`)
- Bottom corners rounded (`rounded-b-lg`)
- No separator line

This creates a unified appearance with 2px borders only on the outer edges and thin 1px separator lines between cards.

### Base Card Styles

- Outer borders: 2px (`border-2`) in `border-gray-200 dark:border-zinc-700`
- Inner separators: 1px between cards (added by RadioCardGroup)
- Padding: `p-4`
- Hover: `hover:bg-gray-50 dark:hover:bg-zinc-800/50`
- Selected: `has-[:checked]:border-indigo-600 dark:has-[:checked]:border-indigo-500`

### Radio Input Styles

- Size: `h-4 w-4`
- Color: `text-indigo-600`
- Border: `border-gray-300`
- Focus ring: `focus:ring-indigo-600`

### Disabled State

- Opacity: `opacity-50`
- Cursor: `cursor-not-allowed`

## Accessibility

### Keyboard Navigation

- **Tab**: Navigate between radio cards
- **Arrow Keys**: Select within radio group (native radio behavior)
- **Space**: Select focused radio card

### Screen Reader Support

- Uses semantic HTML (`<label>`, `<input type="radio">`)
- Radio inputs are properly associated with labels
- Group name provides context for radio group

### Focus Management

- Visible focus ring on radio input
- `focus:ring-indigo-600` class for clear focus indication
- Focus visible in both light and dark modes

### Disabled State

- Visual indication with reduced opacity
- Cursor changes to `not-allowed`
- Input is properly disabled with `disabled` attribute
- Cannot be selected via keyboard or mouse

## Dark Mode

The component fully supports dark mode with:
- Dark borders: `dark:border-zinc-700`
- Dark hover: `dark:hover:bg-zinc-800/50`
- Dark selected: `dark:has-[:checked]:border-indigo-500`
- Dark text: `dark:text-zinc-100`

All color variants adapt automatically when dark mode is enabled.

## Use Cases

- Plan/tier selection
- Payment method selection
- Satellite/server selection
- Feature toggle cards
- Settings options
- Multi-step form choices
- Any scenario requiring visual radio button selection

## Notes

- RadioCard can be used standalone or within RadioCardGroup
- RadioCardGroup provides automatic name management and v-model syncing
- The component uses native radio inputs for full accessibility
- Selected state uses the `has-[:checked]` Tailwind selector for optimal styling
- All state (hover, selected, disabled) has visual feedback
