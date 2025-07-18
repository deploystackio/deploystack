<script setup lang="ts">
import { } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cloud, Monitor, Check } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Props and model
const modelValue = defineModel<string>({ required: true })

const { t } = useI18n()

// Platform options
const platforms = [
  {
    id: 'local',
    name: t('mcpInstallations.wizard.platform.local.name'),
    description: t('mcpInstallations.wizard.platform.local.description'),
    icon: Monitor,
    available: true,
    recommended: false,
    features: [
      t('mcpInstallations.wizard.platform.local.features.direct'),
      t('mcpInstallations.wizard.platform.local.features.fast'),
      t('mcpInstallations.wizard.platform.local.features.secure')
    ]
  },
  // {
  //   id: 'docker',
  //   name: t('mcpInstallations.wizard.platform.docker.name'),
  //   description: t('mcpInstallations.wizard.platform.docker.description'),
  //   icon: Server,
  //   available: false,
  //   recommended: false,
  //   features: [
  //     t('mcpInstallations.wizard.platform.docker.features.isolated'),
  //     t('mcpInstallations.wizard.platform.docker.features.portable'),
  //     t('mcpInstallations.wizard.platform.docker.features.scalable')
  //   ]
  // },
  {
    id: 'cloud',
    name: t('mcpInstallations.wizard.platform.cloud.name'),
    description: t('mcpInstallations.wizard.platform.cloud.description'),
    icon: Cloud,
    available: false,
    recommended: false,
    features: [
      t('mcpInstallations.wizard.platform.cloud.features.managed'),
      t('mcpInstallations.wizard.platform.cloud.features.scalable'),
      t('mcpInstallations.wizard.platform.cloud.features.redundant')
    ]
  }
]


// Methods
const selectPlatform = (platformId: string) => {
  const platform = platforms.find(p => p.id === platformId)
  if (platform?.available) {
    modelValue.value = platformId
  }
}

// Set default to local if not set
if (!modelValue.value) {
  modelValue.value = 'local'
}
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

    <!-- Platform Options -->
    <div class="grid gap-4">
      <Card
        v-for="platform in platforms"
        :key="platform.id"
        :class="cn(
          'cursor-pointer transition-all duration-200 hover:shadow-md',
          {
            'ring-2 ring-blue-500 bg-blue-50': modelValue === platform.id && platform.available,
            'opacity-50 cursor-not-allowed': !platform.available,
            'hover:border-blue-300': platform.available && modelValue !== platform.id
          }
        )"
        @click="selectPlatform(platform.id)"
      >
        <CardHeader>
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div
                :class="cn(
                  'p-2 rounded-lg',
                  {
                    'bg-blue-100 text-blue-600': modelValue === platform.id && platform.available,
                    'bg-gray-100 text-gray-400': !platform.available,
                    'bg-gray-100 text-gray-600': platform.available && modelValue !== platform.id
                  }
                )"
              >
                <component :is="platform.icon" class="h-6 w-6" />
              </div>
              <div>
                <CardTitle class="flex items-center gap-2">
                  {{ platform.name }}
                  <Badge v-if="platform.recommended && platform.available" variant="default" class="text-xs">
                    {{ t('labels.recommended') }}
                  </Badge>
                  <Badge v-if="!platform.available" variant="secondary" class="text-xs">
                    {{ t('labels.comingSoon') }}
                  </Badge>
                </CardTitle>
                <CardDescription class="mt-1">
                  {{ platform.description }}
                </CardDescription>
              </div>
            </div>

            <!-- Selection indicator -->
            <div
              v-if="modelValue === platform.id && platform.available"
              class="flex items-center justify-center w-6 h-6 bg-blue-500 rounded-full"
            >
              <Check class="h-4 w-4 text-white" />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <!-- Features -->
          <div class="space-y-2">
            <h4 class="text-sm font-medium text-gray-700">
              {{ t('mcpInstallations.wizard.platform.features') }}:
            </h4>
            <ul class="space-y-1">
              <li
                v-for="feature in platform.features"
                :key="feature"
                class="flex items-center gap-2 text-sm text-gray-600"
              >
                <div class="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                {{ feature }}
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>

  </div>
</template>
