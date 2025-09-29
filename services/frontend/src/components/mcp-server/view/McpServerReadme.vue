<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'

interface Props {
  readmeBase64?: string | null
  serverName: string
}

const props = defineProps<Props>()

marked.setOptions({
  gfm: true,
  breaks: true,
})

const renderedMarkdown = computed(() => {
  if (!props.readmeBase64) {
    return '<p class="text-muted-foreground">No README available for this server.</p>'
  }

  try {
    // Decode base64 to binary string
    const binaryString = atob(props.readmeBase64)
    
    // Convert binary string to UTF-8
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    // Decode as UTF-8
    const decoder = new TextDecoder('utf-8')
    const decodedMarkdown = decoder.decode(bytes)
    
    return marked.parse(decodedMarkdown)
  } catch (error) {
    console.error('Failed to parse README:', error)
    return '<p class="text-red-500">Failed to load README content.</p>'
  }
})
</script>

<template>
  <div class="readme-container min-h-[400px]">
    <article 
      class="markdown-body prose prose-slate max-w-none" 
      v-html="renderedMarkdown"
    />
  </div>
</template>

<style scoped>
.markdown-body {
  font-size: 0.875rem;
  line-height: 1.625;
}

.markdown-body :deep(h1) {
  font-size: 1.5rem;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
  margin-bottom: 1rem;
}

.markdown-body :deep(h2) {
  font-size: 1.25rem;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.5rem;
  margin-bottom: 0.75rem;
  margin-top: 1.5rem;
}

.markdown-body :deep(h3) {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-top: 1.25rem;
}

.markdown-body :deep(p) {
  margin-bottom: 1rem;
}

.markdown-body :deep(a) {
  color: #2563eb;
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(code) {
  background-color: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.markdown-body :deep(pre) {
  background-color: #1f2937;
  color: #f3f4f6;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 1rem;
}

.markdown-body :deep(pre code) {
  background-color: transparent;
  padding: 0;
  color: inherit;
}

.markdown-body :deep(blockquote) {
  border-left: 4px solid #d1d5db;
  padding-left: 1rem;
  font-style: italic;
  color: #6b7280;
  margin: 1rem 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5rem;
  margin-bottom: 1rem;
}

.markdown-body :deep(ul) {
  list-style-type: disc;
}

.markdown-body :deep(ol) {
  list-style-type: decimal;
}

.markdown-body :deep(li) {
  margin-bottom: 0.25rem;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.markdown-body :deep(th) {
  border: 1px solid #d1d5db;
  background-color: #f9fafb;
  padding: 0.5rem 0.75rem;
  text-align: left;
  font-weight: 600;
}

.markdown-body :deep(td) {
  border: 1px solid #d1d5db;
  padding: 0.5rem 0.75rem;
}

.markdown-body :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.375rem;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1.5rem 0;
}
</style>
