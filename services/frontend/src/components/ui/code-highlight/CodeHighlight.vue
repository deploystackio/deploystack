<script setup lang="ts">
import { computed } from 'vue'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-yaml'
import 'prismjs/themes/prism.css'

interface Props {
  code: string
  language?: string
}

const props = withDefaults(defineProps<Props>(), {
  language: 'javascript'
})

const highlightedCode = computed(() => {
  try {
    const grammar = Prism.languages[props.language]
    if (!grammar) {
      return props.code
    }
    return Prism.highlight(props.code, grammar, props.language)
  } catch {
    return props.code
  }
})
</script>

<template>
  <pre :class="`language-${language}`"><code v-html="highlightedCode"></code></pre>
</template>
