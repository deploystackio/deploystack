<script setup lang="ts">
import { ref, watch } from 'vue'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import GitHubAppRepository from './GitHubAppRepository.vue'
import PublicRepository from './PublicRepository.vue'

interface RepositorySelection {
  url: string
  name: string
  branch: string
  deployment_source: 'github_app' | 'github_public'
}

const props = defineProps<{
  modelValue?: RepositorySelection
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RepositorySelection]
  'public-url-valid': [valid: boolean]
  'public-branches-loaded': [loaded: boolean]
}>()

const activeTab = ref<'github_app' | 'github_public'>(props.modelValue?.deployment_source ?? 'github_app')
const isInitialMount = ref(true)
const publicRepoRef = ref<InstanceType<typeof PublicRepository> | null>(null)
const isCheckingPublicRepo = ref(false)

function emitEmpty() {
  emit('update:modelValue', {
    url: '',
    name: '',
    branch: '',
    deployment_source: activeTab.value
  })
}

function handleGitHubAppSelection(selection: { url: string; name: string; branch: string }) {
  if (selection.url && selection.branch) {
    emit('update:modelValue', {
      ...selection,
      deployment_source: 'github_app'
    })
  } else {
    emitEmpty()
  }
}

function handlePublicSelection(selection: { url: string; name: string; branch: string }) {
  if (selection.url && selection.branch) {
    emit('update:modelValue', {
      ...selection,
      deployment_source: 'github_public'
    })
  } else {
    emitEmpty()
  }
}

function handlePublicUrlValid(valid: boolean) {
  emit('public-url-valid', valid)
}

function handlePublicBranchesLoaded(loaded: boolean) {
  emit('public-branches-loaded', loaded)
}

async function checkPublicRepository() {
  if (!publicRepoRef.value) return
  isCheckingPublicRepo.value = true
  try {
    await publicRepoRef.value.checkRepository()
  } finally {
    isCheckingPublicRepo.value = false
  }
}

// Reset parent state when switching tabs (skip on initial mount if restoring state)
watch(activeTab, (newTab) => {
  if (isInitialMount.value && newTab === props.modelValue?.deployment_source) {
    isInitialMount.value = false
    return
  }
  isInitialMount.value = false
  emitEmpty()
  emit('public-url-valid', false)
  emit('public-branches-loaded', false)
})

defineExpose({
  activeTab,
  checkPublicRepository,
  isCheckingPublicRepo
})
</script>

<template>
  <div class="space-y-6">
    <Tabs v-model="activeTab" class="w-full">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="github_app" :disabled="readonly">
          GitHub App
        </TabsTrigger>
        <TabsTrigger value="github_public" :disabled="readonly">
          Public Repository
        </TabsTrigger>
      </TabsList>

      <TabsContent value="github_app" class="mt-6">
        <GitHubAppRepository @update:selection="handleGitHubAppSelection" />
      </TabsContent>

      <TabsContent value="github_public" class="mt-6">
        <PublicRepository
          ref="publicRepoRef"
          :is-checking="isCheckingPublicRepo"
          :initial-url="modelValue?.deployment_source === 'github_public' ? modelValue?.url : ''"
          :initial-branch="modelValue?.deployment_source === 'github_public' ? modelValue?.branch : ''"
          @update:selection="handlePublicSelection"
          @url-valid="handlePublicUrlValid"
          @branches-loaded="handlePublicBranchesLoaded"
        />
      </TabsContent>
    </Tabs>
  </div>
</template>
