<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
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
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { UserService } from '@/services/userService'
import type { User } from '@/views/admin/users/types'

interface Props {
  user: User
}

const props = defineProps<Props>()
const { t } = useI18n()

const isResetLoading = ref(false)

const canResetPassword = computed(() => {
  return props.user?.auth_type === 'email_signup'
})

const handlePasswordReset = async () => {
  if (!props.user) return

  try {
    isResetLoading.value = true
    const result = await UserService.adminResetPassword(props.user.email)

    if (result.success) {
      toast.success(t('adminUsers.userDetail.actions.resetPasswordSuccess', {
        email: props.user.email
      }))
    }
  } catch (error) {
    const errorKey = 'adminUsers.userDetail.actions.resetPasswordError'
    let errorText = error instanceof Error ? error.message : 'Unknown error'

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
    isResetLoading.value = false
  }
}
</script>

<template>
  <AlertDialog>
    <AlertDialogTrigger as-child>
      <Button
        variant="outline"
        :disabled="!canResetPassword || isResetLoading"
        :title="!canResetPassword ? t('adminUsers.userDetail.actions.resetPasswordDisabled') : undefined"
      >
        <Spinner v-if="isResetLoading" class="mr-2" />
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
            :disabled="isResetLoading"
          >
            <Spinner v-if="isResetLoading" class="mr-2" />
            {{ t('adminUsers.userDetail.actions.resetPasswordConfirm.confirm') }}
          </Button>
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
