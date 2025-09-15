<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Globe, Users } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'

// Props and model
const modelValue = defineModel<string>({ required: true })

// Set default to global immediately
if (!modelValue.value) {
  modelValue.value = 'global'
}

const { t } = useI18n()

// Platform options
const platforms = [
  {
    id: 'global',
    name: t('mcpInstallations.wizard.platform.global.name'),
    description: t('mcpInstallations.wizard.platform.global.description'),
    icon: Globe,
    available: true,
    recommended: true,
    details: [
      t('mcpInstallations.wizard.platform.global.features.instant'),
      t('mcpInstallations.wizard.platform.global.features.managed')
    ]
  },
  {
    id: 'team',
    name: t('mcpInstallations.wizard.platform.team.name'),
    description: t('mcpInstallations.wizard.platform.team.description'),
    icon: Users,
    available: false,
    recommended: false,
    details: [
      t('mcpInstallations.wizard.platform.team.features.secure'),
      t('mcpInstallations.wizard.platform.team.features.private')
    ]
  }
]

// Ensure default is set when component mounts
onMounted(() => {
  if (!modelValue.value) {
    modelValue.value = 'global'
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Step Header -->
    <div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        {{ t('mcpInstallations.wizard.platform.title') }}
      </h2>
      <p class="text-gray-600">
        {{ t('mcpInstallations.wizard.platform.description') }}
      </p>
    </div>

    <!-- Platform Selection -->
    <fieldset :aria-label="t('mcpInstallations.wizard.platform.title')">
      <div class="space-y-4">
        <div
          v-for="platform in platforms"
          :key="platform.id"
          :class="[
            'group relative block rounded-lg border-1 px-6 py-4 cursor-pointer transition-all duration-200',
            'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
            'sm:flex sm:justify-between',
            // Use the same gray background pattern as ProgressBars
            platform.available
              ? modelValue === platform.id
                ? '!border-primary bg-muted/50'
                : 'border-gray-300 bg-white hover:border-gray-400'
              : '!border-gray-50 !bg-gray-50 opacity-60 cursor-not-allowed'
          ]"
          @click="() => platform.available && (modelValue = platform.id)"
        >
          <input
            type="radio"
            name="platform"
            :value="platform.id"
            v-model="modelValue"
            :disabled="!platform.available"
            class="sr-only"
          />

          <span class="flex items-center relative z-10">
            <span class="flex items-center gap-3 mr-4">
              <!-- Platform Icon -->
              <div :class="[
                'p-2 rounded-lg transition-colors',
                modelValue === platform.id && platform.available
                  ? 'bg-primary/10 text-primary'
                  : platform.available
                    ? 'bg-gray-100 text-gray-600'
                    : 'bg-gray-100 text-gray-400'
              ]">
                <component :is="platform.icon" class="h-5 w-5" />
              </div>

              <!-- Platform Info -->
              <span class="flex flex-col text-sm">
                <span class="flex items-center gap-2">
                  <span class="font-medium text-base text-gray-900">
                    {{ platform.name }}
                  </span>
                  <Badge v-if="platform.recommended && platform.available" variant="default" class="text-xs">
                    {{ t('labels.recommended') }}
                  </Badge>
                  <Badge v-if="!platform.available" variant="secondary" class="text-xs">
                    {{ t('labels.comingSoon') }}
                  </Badge>
                </span>
                <span class="text-sm mt-1 text-gray-600">
                  <span class="block sm:inline">{{ platform.details[0] }}</span>
                  <span v-if="platform.details[1]" class="hidden sm:mx-1 sm:inline" aria-hidden="true">&middot;</span>
                  <span v-if="platform.details[1]" class="block sm:inline">{{ platform.details[1] }}</span>
                </span>
              </span>
            </span>
          </span>

          <!-- Selection Indicator -->
          <div
            v-if="modelValue === platform.id && platform.available"
            class="absolute top-4 right-4 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
          >
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    </fieldset>
  </div>
</template>
