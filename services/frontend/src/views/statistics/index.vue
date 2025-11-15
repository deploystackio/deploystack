<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import DashboardLayout from '@/components/DashboardLayout.vue'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Construction } from 'lucide-vue-next'

const { t } = useI18n()
</script>

<template>
  <DashboardLayout :title="t('statistics.title')">
    <div class="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle class="flex items-center gap-2">
            <Construction class="h-5 w-5" />
            {{ t('statistics.underConstruction.title') }}
          </CardTitle>
          <CardDescription>
            {{ t('statistics.underConstruction.description') }}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-muted-foreground">
            {{ t('statistics.underConstruction.message') }}
          </p>
        </CardContent>
      </Card>
    </div>
  </DashboardLayout>
</template>
