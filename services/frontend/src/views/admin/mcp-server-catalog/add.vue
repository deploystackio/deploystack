<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ArrowLeft, FileText, Github, Code, Zap, CheckCircle } from 'lucide-vue-next'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { McpCatalogService } from '@/services/mcpCatalogService'
import { useEventBus } from '@/composables/useEventBus'
import BasicInfoStep from '@/components/admin/mcp-catalog/BasicInfoStep.vue'
import TechnicalStep from '@/components/admin/mcp-catalog/TechnicalStep.vue'
import CapabilitiesStep from '@/components/admin/mcp-catalog/CapabilitiesStep.vue'
import GitHubRepositoryStep from '@/components/admin/mcp-catalog/GitHubRepositoryStep.vue'
import ReviewStep from '@/components/admin/mcp-catalog/ReviewStep.vue'
import type {
  McpServerFormData,
  CreateMcpServerRequest
} from './types'

const { t } = useI18n()
const router = useRouter()
const eventBus = useEventBus()

// Form steps configuration
const steps = [
  {
    key: 'github' as const,
    label: 'GitHub Repository',
    icon: Github,
    component: GitHubRepositoryStep
  },
  {
    key: 'basic' as const,
    label: t('mcpCatalog.form.steps.basic'),
    icon: FileText,
    component: BasicInfoStep
  },
  {
    key: 'technical' as const,
    label: t('mcpCatalog.form.steps.technical'),
    icon: Code,
    component: TechnicalStep
  },
  {
    key: 'capabilities' as const,
    label: t('mcpCatalog.form.steps.capabilities'),
    icon: Zap,
    component: CapabilitiesStep
  },
  {
    key: 'review' as const,
    label: t('mcpCatalog.form.steps.review'),
    icon: CheckCircle,
    component: ReviewStep
  }
]

// State
const currentStep = ref(0)
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)

// Form data with proper initialization
const formData = ref<McpServerFormData>({
  basic: {
    name: '',
    description: '',
    long_description: '',
    category_id: '',
    author_name: '',
    author_contact: '',
    organization: '',
    license: '',
    tags: []
  },
  repository: {
    github_url: '',
    git_branch: 'main',
    homepage_url: ''
  },
  technical: {
    language: '',
    runtime: '',
    runtime_min_version: '',
    installation_methods: [],
    dependencies: ''
  },
  capabilities: {
    tools: [],
    resources: [],
    prompts: [],
    environment_variables: [],
    default_config: ''
  },
  github: {
    github_url: '',
    git_branch: 'main',
    auto_populated: false
  },
  review: {}
})

// Computed properties
const currentStepData = computed(() => steps[currentStep.value])
const isFirstStep = computed(() => currentStep.value === 0)
const isLastStep = computed(() => currentStep.value === steps.length - 1)
const canGoNext = computed(() => !isLastStep.value)
const canGoPrevious = computed(() => !isFirstStep.value)

// Navigation methods
const goToStep = (stepIndex: number) => {
  if (stepIndex >= 0 && stepIndex < currentStep.value) {
    currentStep.value = stepIndex
  }
}

const nextStep = () => {
  if (canGoNext.value) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (canGoPrevious.value) {
    currentStep.value--
  }
}

const goBack = () => {
  router.push('/admin/mcp-server-catalog')
}

// Form persistence using event bus
const saveFormData = () => {
  eventBus.emit('mcp-form-data-updated', {
    step: currentStep.value,
    data: formData.value
  })
}

const loadFormData = () => {
  // Try to load persisted form data
  // This would be implemented with localStorage or session storage
  // For now, we'll keep the default empty form
}

const resetForm = () => {
  currentStep.value = 0
  formData.value = {
    basic: {
      name: '',
      description: '',
      long_description: '',
      category_id: '',
      author_name: '',
      author_contact: '',
      organization: '',
      license: '',
      tags: []
    },
    repository: {
      github_url: '',
      git_branch: 'main',
      homepage_url: ''
    },
    technical: {
      language: '',
      runtime: '',
      runtime_min_version: '',
      installation_methods: [],
      dependencies: ''
    },
    capabilities: {
      tools: [],
      resources: [],
      prompts: [],
      environment_variables: [],
      default_config: ''
    },
    github: {
      github_url: '',
      git_branch: 'main',
      auto_populated: false
    },
    review: {}
  }
  eventBus.emit('mcp-form-data-cleared')
}

// Form submission
const submitForm = async () => {
  try {
    isSubmitting.value = true
    submitError.value = null

    // Convert form data to API request format
    const requestData: CreateMcpServerRequest = {
      // Basic info
      name: formData.value.basic.name,
      description: formData.value.basic.description,
      long_description: formData.value.basic.long_description || undefined,
      category_id: formData.value.basic.category_id || undefined,
      author_name: formData.value.basic.author_name || undefined,
      author_contact: formData.value.basic.author_contact || undefined,
      organization: formData.value.basic.organization || undefined,
      license: formData.value.basic.license || undefined,
      tags: formData.value.basic.tags.length > 0 ? formData.value.basic.tags : undefined,

      // Repository (use GitHub data if available, fallback to repository data)
      github_url: formData.value.github.github_url || formData.value.repository.github_url || undefined,
      git_branch: formData.value.github.git_branch || formData.value.repository.git_branch || 'main',
      homepage_url: formData.value.repository.homepage_url || undefined,

      // Technical
      language: formData.value.technical.language,
      runtime: formData.value.technical.runtime,
      runtime_min_version: formData.value.technical.runtime_min_version || undefined,
      installation_methods: formData.value.technical.installation_methods,
      dependencies: formData.value.technical.dependencies ? JSON.parse(formData.value.technical.dependencies) : undefined,

      // Capabilities
      tools: formData.value.capabilities.tools,
      resources: formData.value.capabilities.resources.length > 0 ? formData.value.capabilities.resources : undefined,
      prompts: formData.value.capabilities.prompts.length > 0 ? formData.value.capabilities.prompts : undefined,
      environment_variables: formData.value.capabilities.environment_variables.length > 0 ? formData.value.capabilities.environment_variables : undefined,
      default_config: formData.value.capabilities.default_config ? JSON.parse(formData.value.capabilities.default_config) : undefined,

      // Server settings
      visibility: 'global',
      featured: false
    }

    // Submit to API
    await McpCatalogService.createGlobalServer(requestData)

    // Clear form data
    resetForm()

    // Emit success event
    eventBus.emit('mcp-server-created')

    // Navigate back to catalog
    router.push('/admin/mcp-server-catalog')

  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to create MCP server'
  } finally {
    isSubmitting.value = false
  }
}

// Lifecycle
onMounted(() => {
  loadFormData()
})

onUnmounted(() => {
  saveFormData()
})
</script>

<template>
  <DashboardLayout :title="t('mcpCatalog.form.title')">
    <div class="space-y-6">
      <!-- Header with back button -->
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="sm" @click="goBack" class="flex items-center gap-2">
          <ArrowLeft class="h-4 w-4" />
          Back to Catalog
        </Button>
      </div>

      <!-- Breadcrumb Navigation -->
      <Breadcrumb>
        <BreadcrumbList>
          <template v-for="(step, index) in steps" :key="index">
            <BreadcrumbItem>
              <!-- Current Step -->
              <BreadcrumbPage v-if="index === currentStep" class="flex items-center gap-2">
                <component :is="step.icon" class="h-4 w-4" />
                <span>{{ step.label }}</span>
              </BreadcrumbPage>

              <!-- Completed Steps (clickable) -->
              <BreadcrumbLink
                v-else-if="index < currentStep"
                @click="goToStep(index)"
                class="flex items-center gap-2 cursor-pointer hover:text-foreground"
              >
                <component :is="step.icon" class="h-4 w-4" />
                <span>{{ step.label }}</span>
              </BreadcrumbLink>

              <!-- Future Steps (disabled) -->
              <span v-else class="flex items-center gap-2 text-muted-foreground">
                <component :is="step.icon" class="h-4 w-4" />
                <span>{{ step.label }}</span>
              </span>
            </BreadcrumbItem>

            <!-- Separator -->
            <BreadcrumbSeparator v-if="index < steps.length - 1" />
          </template>
        </BreadcrumbList>
      </Breadcrumb>

      <!-- Error Message -->
      <div v-if="submitError" class="rounded-md bg-red-50 p-4 border border-red-200">
        <div class="text-sm text-red-800">
          {{ submitError }}
        </div>
      </div>

      <!-- Step Content -->
      <div class="bg-white rounded-lg border p-6">
        <component
          :is="currentStepData.component"
          v-model="formData[currentStepData.key]"
          :form-data="formData"
        />
      </div>

      <!-- Navigation Buttons -->
      <div class="flex items-center justify-between">
        <Button
          v-if="canGoPrevious"
          variant="outline"
          @click="previousStep"
        >
          {{ t('mcpCatalog.form.navigation.previous') }}
        </Button>
        <div v-else></div>

        <div class="flex items-center gap-2">
          <Button
            variant="ghost"
            @click="goBack"
          >
            {{ t('mcpCatalog.form.navigation.cancel') }}
          </Button>

          <Button
            v-if="canGoNext"
            @click="nextStep"
          >
            {{ t('mcpCatalog.form.navigation.next') }}
          </Button>

          <Button
            v-else
            @click="submitForm"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'Creating...' : t('mcpCatalog.form.navigation.submit') }}
          </Button>
        </div>
      </div>
    </div>
  </DashboardLayout>
</template>
