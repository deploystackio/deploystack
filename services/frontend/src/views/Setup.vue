<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="w-full max-w-4xl">
      <Card class="shadow-lg">
        <CardHeader class="text-center">
          <CardTitle class="text-2xl font-bold">{{ $t('setup.title') }}</CardTitle>
          <CardDescription>
            {{ $t('setup.description') }}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <!-- Setup success message -->
          <div v-if="setupSuccessMessageVisible">
            <Alert class="mb-4" variant="default">
              <CheckCircle class="h-4 w-4" />
              <AlertTitle>{{ $t('setup.success.title') }}</AlertTitle>
              <AlertDescription>
                {{ $t('setup.success.description') }}
              </AlertDescription>
            </Alert>
            <!-- Optionally, add a button to go to login or elsewhere -->
            <Button @click="goToRegister" class="w-full mt-4">
              {{ $t('setup.success.buttonAcknowledge') }}
            </Button>
          </div>

          <!-- Already configured message -->
          <div v-else-if="databaseStore.canProceedToApp">
            <Alert class="mb-4">
              <CheckCircle class="h-4 w-4" />
              <AlertTitle>{{ $t('setup.alreadyConfigured.title') }}</AlertTitle>
              <AlertDescription>
                {{ $t('setup.alreadyConfigured.description') }}
              </AlertDescription>
            </Alert>

            <Button @click="goToRegister" class="w-full">
              {{ $t('setup.alreadyConfigured.button') }}
            </Button>
          </div>

          <!-- Database selection -->
          <div v-else class="space-y-6">
            <div class="text-center">
              <h2 class="text-xl font-semibold mb-2">{{ $t('setup.databaseSelection.title') }}</h2>
              <p class="text-muted-foreground">{{ $t('setup.databaseSelection.subtitle') }}</p>
            </div>

            <!-- Database Options -->
            <div class="grid gap-4 md:grid-cols-1 lg:grid-cols-2 max-w-4xl mx-auto">
              <DatabaseOptionCard
                v-for="dbOption in databaseOptions"
                :key="dbOption.type"
                :database="dbOption"
                :selected="selectedType === dbOption.type"
                @select="selectedType = $event as DatabaseType"
              />
            </div>

            <!-- Environment Variables Warning (for Turso) -->
            <Alert v-if="selectedOption?.requiresEnvVars" class="border-amber-200 bg-amber-50">
              <AlertTriangle class="h-4 w-4 text-amber-600" />
              <AlertTitle class="text-amber-800">{{ $t('setup.environmentWarning.title') }}</AlertTitle>
              <AlertDescription class="text-amber-700">
                {{ $t('setup.environmentWarning.description') }}
                <ul class="mt-2 list-disc list-inside space-y-1">
                  <li v-for="envVar in selectedOption.envVars" :key="envVar">
                    <code class="bg-amber-100 px-1 py-0.5 rounded text-xs">{{ envVar }}</code>
                  </li>
                </ul>
              </AlertDescription>
            </Alert>

            <!-- Error Display -->
            <Alert v-if="databaseStore.error" variant="destructive">
              <AlertCircle class="h-4 w-4" />
              <AlertTitle>{{ $t('setup.errors.title') }}</AlertTitle>
              <AlertDescription>
                {{ databaseStore.error }}
                <br>
                <span class="text-sm">{{ $t('setup.errors.checkLogs') }}</span>
              </AlertDescription>
            </Alert>

            <!-- Setup Button -->
            <div class="flex justify-center">
              <Button
                @click="onSubmit"
                class="w-full max-w-md"
                :disabled="databaseStore.isLoading"
                size="lg"
              >
                <Loader2 v-if="databaseStore.isLoading" class="mr-2 h-4 w-4 animate-spin" />
                {{ databaseStore.isLoading ? $t('setup.buttons.loading') : $t('setup.buttons.submit') }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { CheckCircle, AlertCircle, AlertTriangle, Loader2 } from 'lucide-vue-next';

import { useDatabaseStore } from '@/stores/database';
import { DatabaseType, type DatabaseOption } from '@/types/database';
import DatabaseOptionCard from '@/components/DatabaseOptionCard.vue';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const router = useRouter();
const databaseStore = useDatabaseStore();

const setupSuccessMessageVisible = ref(false);
const selectedType = ref<DatabaseType>(DatabaseType.SQLite);

// Database options configuration
const databaseOptions: DatabaseOption[] = [
  {
    type: DatabaseType.SQLite,
    name: 'setup.databaseTypes.sqlite.name',
    subtitle: 'setup.databaseTypes.sqlite.subtitle',
    description: 'setup.databaseTypes.sqlite.description',
    features: [
      'setup.databaseTypes.sqlite.features.noSetup',
      'setup.databaseTypes.sqlite.features.immediate',
      'setup.databaseTypes.sqlite.features.development'
    ],
    recommended: 'development',
    requiresEnvVars: false
  },
  {
    type: DatabaseType.Turso,
    name: 'setup.databaseTypes.turso.name',
    subtitle: 'setup.databaseTypes.turso.subtitle',
    description: 'setup.databaseTypes.turso.description',
    features: [
      'setup.databaseTypes.turso.features.multiRegion',
      'setup.databaseTypes.turso.features.lowLatency',
      'setup.databaseTypes.turso.features.advanced'
    ],
    recommended: 'advanced',
    requiresEnvVars: true,
    envVars: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN']
  }
];

// Get the currently selected database option
const selectedOption = computed(() => {
  return databaseOptions.find(option => option.type === selectedType.value);
});

const onSubmit = async () => {
  databaseStore.clearError();
  setupSuccessMessageVisible.value = false;

  const success = await databaseStore.setupDatabase({
    type: selectedType.value,
  });

  if (success) {
    setupSuccessMessageVisible.value = true;
    await databaseStore.checkDatabaseStatus(true);
  }
};

function goToRegister() {
  router.push('/register');
}

// Check database status on component mount
onMounted(async () => {
  await databaseStore.checkDatabaseStatus(false);
});
</script>
