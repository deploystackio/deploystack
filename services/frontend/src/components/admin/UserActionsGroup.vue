<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserService } from '@/services/userService'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-vue-next'
import type { User } from '@/views/admin/users/types'

interface Props {
  user: User
}

const props = defineProps<Props>()
const { t } = useI18n()

const isLoading = ref(false)
const successMessage = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const showDialog = ref(false)

// Check if user can have password reset (only email users)
const canResetPassword = computed(() => {
  return props.user.auth_type === 'email_signup'
})

// Handle password reset
const handlePasswordReset = async () => {
  try {
    isLoading.value = true
    errorMessage.value = null
    
    const result = await UserService.adminResetPassword(props.user.email)
    
    if (result.success) {
      successMessage.value = t('adminUsers.userDetail.actions.resetPasswordSuccess', { 
        email: props.user.email 
      })
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        successMessage.value = null
      }, 5000)
    }
  } catch (error) {
    let errorKey = 'adminUsers.userDetail.actions.resetPasswordError'
    let errorText = error instanceof Error ? error.message : 'Unknown error'
    
    // Handle specific error types
    if (error instanceof Error) {
      switch (error.message) {
        case 'INVALID_USER':
          errorText = 'User not found or not eligible for password reset'
          break
        case 'UNAUTHORIZED':
          errorText = 'You are not authorized to perform this action'
          break
        case 'FORBIDDEN':
          errorText = 'This action is forbidden'
          break
        case 'SERVICE_UNAVAILABLE':
          errorText = 'Email service is currently unavailable'
          break
      }
    }
    
    errorMessage.value = t(errorKey, { error: errorText })
  } finally {
    isLoading.value = false
    showDialog.value = false
  }
}

// Clear messages
const clearMessages = () => {
  successMessage.value = null
  errorMessage.value = null
}
</script>

<template>
  <div class="space-y-4">
    <!-- Success Message -->
    <Alert v-if="successMessage" class="border-green-200 bg-green-50">
      <CheckCircle class="h-4 w-4 text-green-600" />
      <AlertDescription class="text-green-800">
        {{ successMessage }}
        <button 
          @click="clearMessages"
          class="ml-2 text-green-600 hover:text-green-800 underline text-sm"
        >
          Dismiss
        </button>
      </AlertDescription>
    </Alert>

    <!-- Error Message -->
    <Alert v-if="errorMessage" variant="destructive">
      <AlertCircle class="h-4 w-4" />
      <AlertDescription>
        {{ errorMessage }}
        <button 
          @click="clearMessages"
          class="ml-2 text-red-600 hover:text-red-800 underline text-sm"
        >
          Dismiss
        </button>
      </AlertDescription>
    </Alert>

    <!-- Actions Group -->
    <div class="border rounded-lg p-4 bg-gray-50">
      <h3 class="text-sm font-medium text-gray-900 mb-3">
        {{ t('adminUsers.userDetail.actions.title') }}
      </h3>
      
      <div class="flex flex-col sm:flex-row gap-2">
        <!-- Force Reset Password Button -->
        <AlertDialog v-model:open="showDialog">
          <AlertDialogTrigger as-child>
            <Button
              variant="outline"
              :disabled="!canResetPassword || isLoading"
              :title="!canResetPassword ? t('adminUsers.userDetail.actions.resetPasswordDisabled') : undefined"
              class="justify-start"
            >
              <Loader2 v-if="isLoading" class="h-4 w-4 mr-2 animate-spin" />
              {{ t('adminUsers.userDetail.actions.forceResetPassword') }}
            </Button>
          </AlertDialogTrigger>
          
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.title') }}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.description', { 
                  username: user.username 
                }) }}
              </AlertDialogDescription>
            </AlertDialogHeader>
            
            <AlertDialogFooter>
              <AlertDialogCancel>
                {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.cancel') }}
              </AlertDialogCancel>
              <AlertDialogAction @click="handlePasswordReset" :disabled="isLoading">
                <Loader2 v-if="isLoading" class="h-4 w-4 mr-2 animate-spin" />
                {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.confirm') }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      
      <!-- Help text for disabled button -->
      <p v-if="!canResetPassword" class="text-xs text-gray-500 mt-2">
        {{ t('adminUsers.userDetail.actions.resetPasswordDisabled') }}
      </p>
    </div>
  </div>
</template>
