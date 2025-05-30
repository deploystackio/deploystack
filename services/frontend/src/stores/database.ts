import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { databaseService } from '@/services/database';
import type { DbSetupRequest, DatabaseType } from '@/types/database';

export const useDatabaseStore = defineStore('database', () => {
  // State
  const isConfigured = ref(false);
  const isInitialized = ref(false);
  const dialect = ref<DatabaseType | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const setupCompleted = ref(false);

  // Computed
  const isSetupRequired = computed(() => !isConfigured.value || !isInitialized.value);
  const canProceedToApp = computed(() => isConfigured.value && isInitialized.value);

  // Actions
  async function checkDatabaseStatus(useCache = true): Promise<boolean> {
    // Check cache first if requested
    if (useCache) {
      const cached = databaseService.getCachedSetupStatus();
      if (cached !== null) {
        setupCompleted.value = cached;
        isConfigured.value = cached;
        isInitialized.value = cached;
        return cached;
      }
    }

    isLoading.value = true;
    error.value = null;

    try {
      const status = await databaseService.checkStatus();

      isConfigured.value = status.configured;
      isInitialized.value = status.initialized;
      dialect.value = status.dialect;
      setupCompleted.value = status.configured && status.initialized;

      return canProceedToApp.value;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'setup.errors.connectionFailed';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function setupDatabase(config: DbSetupRequest): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      await databaseService.setupDatabase(config);

      // Update state after successful setup
      isConfigured.value = true;
      isInitialized.value = true;
      dialect.value = config.type;
      setupCompleted.value = true;

      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'setup.errors.setupFailed';
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  function clearError(): void {
    error.value = null;
  }

  function resetState(): void {
    isConfigured.value = false;
    isInitialized.value = false;
    dialect.value = null;
    isLoading.value = false;
    error.value = null;
    setupCompleted.value = false;
  }

  function clearCache(): void {
    databaseService.clearCache();
    resetState();
  }

  return {
    // State
    isConfigured,
    isInitialized,
    dialect,
    isLoading,
    error,
    setupCompleted,

    // Computed
    isSetupRequired,
    canProceedToApp,

    // Actions
    checkDatabaseStatus,
    setupDatabase,
    clearError,
    resetState,
    clearCache,
  };
});
