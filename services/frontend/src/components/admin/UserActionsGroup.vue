<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
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
import { UserService } from '@/services/userService'
import type { User } from '@/views/admin/users/types'

interface Props {
  user: User
}

const props = defineProps<Props>()
const { t } = useI18n()

const isLoading = ref(false)
const showDialog = ref(false)

// Check if user can have password reset (only email users)
const canResetPassword = computed(() => {
  return props.user.auth_type === 'email_signup'
})

// Handle password reset
const handlePasswordReset = async () => {
  try {
    isLoading.value = true
    
    const result = await UserService.adminResetPassword(props.user.email)
    
    if (result.success) {
      toast.success(t('adminUsers.userDetail.actions.resetPasswordSuccess', { 
        email: props.user.email 
      }))
    }
  } catch (error) {
    const errorKey = 'adminUsers.userDetail.actions.resetPasswordError'
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
    
    toast.error(t(errorKey, { error: errorText }))
  } finally {
    isLoading.value = false
    showDialog.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
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
              <Spinner v-if="isLoading" class="mr-2" />
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
              <AlertDialogAction as-child>
                <Button
                  @click="handlePasswordReset"
                  :disabled="isLoading"
                >
                  <Spinner v-if="isLoading" class="mr-2" />
                  {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.confirm') }}
                </Button>
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
