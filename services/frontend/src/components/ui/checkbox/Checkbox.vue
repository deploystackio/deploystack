<script setup lang="ts">
interface Props {
  checked?: boolean
  disabled?: boolean
  id?: string
  name?: string
}

const props = withDefaults(defineProps<Props>(), {
  checked: false,
  disabled: false,
})

const emit = defineEmits<{
  'update:checked': [value: boolean]
}>()

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:checked', target.checked)
}
</script>

<template>
  <input
    type="checkbox"
    :id="props.id"
    :name="props.name"
    :checked="props.checked"
    :disabled="props.disabled"
    @change="handleChange"
    class="size-4 cursor-pointer accent-primary"
  />
</template>
