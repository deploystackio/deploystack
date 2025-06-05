<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="w-full max-w-md">
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

          <!-- Setup form -->
          <form v-else @submit="onSubmit" class="space-y-4">
            <!-- Database Type (SQLite only) -->
            <FormField v-slot="{ componentField }" name="type">
              <FormItem>
                <FormLabel>{{ $t('setup.form.databaseType.label') }}</FormLabel>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger class="w-full">
                      <SelectValue :placeholder="$t('setup.form.databaseType.placeholder')" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="sqlite">
                      {{ $t('setup.form.databaseType.options.sqlite') }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {{ $t('setup.form.databaseType.description') }}
                </FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>

            <!-- Error Alert -->
            <Alert v-if="databaseStore.error" variant="destructive">
              <AlertCircle class="h-4 w-4" />
              <AlertTitle>{{ $t('setup.errors.title') }}</AlertTitle>
              <AlertDescription>
                {{ getErrorMessage(databaseStore.error, databaseStore.errorAddress) }}
              </AlertDescription>
            </Alert>

            <!-- Submit Button -->
            <Button
              type="submit"
              class="w-full"
              :disabled="databaseStore.isLoading"
            >
              <Loader2 v-if="databaseStore.isLoading" class="mr-2 h-4 w-4 animate-spin" />
              {{ databaseStore.isLoading ? $t('setup.buttons.loading') : $t('setup.buttons.submit') }}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import * as z from 'zod';
import { useI18n } from 'vue-i18n';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-vue-next';

import { useDatabaseStore } from '@/stores/database';
import { DatabaseType } from '@/types/database';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const router = useRouter();
const databaseStore = useDatabaseStore();
const { t } = useI18n();

// Form validation schema (simplified for SQLite only)
const formSchema = toTypedSchema(
  z.object({
    type: z.nativeEnum(DatabaseType, {
      required_error: t('setup.errors.validationRequired'),
    }),
  })
);

const setupSuccessMessageVisible = ref(false);

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    type: DatabaseType.SQLite, // Default to SQLite since it's the only option
  },
});

const onSubmit = form.handleSubmit(async (values) => {
  databaseStore.clearError();
  setupSuccessMessageVisible.value = false; // Reset on new submission

  const success = await databaseStore.setupDatabase({
    type: values.type,
  });

  if (success) {
    // Display success message instead of immediate redirect
    setupSuccessMessageVisible.value = true;
    // Optionally, still check status to update canProceedToApp if needed
    await databaseStore.checkDatabaseStatus(true);
  }
});

function goToRegister() {
  router.push('/register');
}

// Function to get translated error message
function getErrorMessage(errorKey: string | null, address: string | null): string {
  if (!errorKey) return ''; // Handle null errorKey

  if (errorKey === 'setup.errors.failedToConnectWithAddress' && address) {
    return t(errorKey, { address });
  }
  // Check if error is a translation key (existing logic)
  if (errorKey.startsWith('setup.errors.')) {
    return t(errorKey);
  }
  // Return the error as-is if it's not a translation key
  return errorKey;
}

// Check database status on component mount
onMounted(async () => {
  await databaseStore.checkDatabaseStatus(false); // Force fresh check
});
</script>
