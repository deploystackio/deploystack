<template>
  <div class="flex items-center justify-center min-h-screen bg-background">
    <Card class="w-full max-w-md p-6">
      <CardHeader>
        <CardTitle class="text-center text-2xl font-bold">{{ t('logout.title') }}</CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-center text-muted-foreground">
          {{ message }}
        </p>
        <div class="mt-4 flex justify-center">
          <svg v-if="isLoading" class="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { UserService } from '@/services/userService'

const router = useRouter()
const { t } = useI18n()

const isLoading = ref(true)
const message = ref(t('logout.inProgressMessage'))

onMounted(async () => {
  isLoading.value = true;
  message.value = t('logout.inProgressMessage');
  console.log('Attempting to logout from backend...');

  try {
    // Use the UserService logout method which handles cache clearing
    await UserService.logout();
    console.log('Logout successful');
    message.value = t('logout.successMessage') || t('logout.inProgressMessage');
  } catch (error) {
    console.error('Error during logout:', error);
    message.value = t('common.error');
  } finally {
    isLoading.value = false;
    setTimeout(() => {
      console.log('Redirecting to login page...');
      router.push('/login');
    }, 2000); // Redirect after 2 seconds to allow user to see final message
  }
})
</script>

<style scoped>
/* Add any additional styles if needed */
.bg-background {
  background-color: hsl(var(--background));
}
.text-primary {
  color: hsl(var(--primary));
}
.text-muted-foreground {
  color: hsl(var(--muted-foreground));
}
</style>
