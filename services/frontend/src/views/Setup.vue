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
          <!-- Already configured message -->
          <div v-if="databaseStore.canProceedToApp" class="text-center">
            <Alert class="mb-4">
              <CheckCircle class="h-4 w-4" />
              <AlertTitle>{{ $t('setup.alreadyConfigured.title') }}</AlertTitle>
              <AlertDescription>
                {{ $t('setup.alreadyConfigured.description') }}
              </AlertDescription>
            </Alert>

            <Button @click="goToLogin" class="w-full">
              {{ $t('setup.alreadyConfigured.button') }}
            </Button>
          </div>

          <!-- Setup form -->
          <form v-else @submit="onSubmit" class="space-y-4">
            <!-- Database Type Selection -->
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
                    <SelectItem value="postgres">
                      {{ $t('setup.form.databaseType.options.postgres') }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  {{ $t('setup.form.databaseType.description') }}
                </FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>

            <!-- Connection String for PostgreSQL -->
            <FormField v-slot="{ componentField }" name="connectionString">
              <FormItem v-show="selectedType === 'postgres'">
                <FormLabel>{{ $t('setup.form.connectionString.label') }}</FormLabel>
                <FormControl>
                  <Input
                    v-bind="componentField"
                    type="text"
                    :placeholder="$t('setup.form.connectionString.placeholder')"
                  />
                </FormControl>
                <FormDescription>
                  {{ $t('setup.form.connectionString.description') }}
                </FormDescription>
                <FormMessage />
              </FormItem>
            </FormField>

            <!-- Error Alert -->
            <Alert v-if="databaseStore.error" variant="destructive">
              <AlertCircle class="h-4 w-4" />
              <AlertTitle>{{ $t('setup.errors.title') }}</AlertTitle>
              <AlertDescription>
                {{ getErrorMessage(databaseStore.error) }}
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
import { ref, onMounted, watch } from 'vue';
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
import { Input } from '@/components/ui/input';
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

// Form validation schema
const formSchema = toTypedSchema(
  z.object({
    type: z.nativeEnum(DatabaseType, {
      required_error: t('setup.errors.validationRequired'),
    }),
    connectionString: z.string().optional(),
  }).refine((data) => {
    if (data.type === DatabaseType.Postgres) {
      return data.connectionString && data.connectionString.trim().length > 0;
    }
    return true;
  }, {
    message: t('setup.errors.connectionStringRequired'),
    path: ['connectionString'],
  })
);

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    type: undefined,
    connectionString: '',
  },
});

const selectedType = ref<DatabaseType | undefined>();

// Watch for type changes to show/hide connection string field
watch(() => form.values.type, (newType) => {
  selectedType.value = newType as DatabaseType;
  if (newType !== DatabaseType.Postgres) {
    form.setFieldValue('connectionString', '');
  }
});

const onSubmit = form.handleSubmit(async (values) => {
  databaseStore.clearError();

  const success = await databaseStore.setupDatabase({
    type: values.type,
    connectionString: values.connectionString || undefined,
  });

  if (success) {
    // Redirect to login after successful setup
    router.push('/login');
  }
});

function goToLogin() {
  router.push('/login');
}

// Function to get translated error message
function getErrorMessage(error: string): string {
  // Check if error is a translation key
  if (error.startsWith('setup.errors.')) {
    return t(error);
  }
  // Return the error as-is if it's not a translation key
  return error;
}

// Check database status on component mount
onMounted(async () => {
  await databaseStore.checkDatabaseStatus(false); // Force fresh check
});
</script>
