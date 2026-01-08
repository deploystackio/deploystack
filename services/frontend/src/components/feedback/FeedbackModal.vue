<script setup lang="ts">
import { ref } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'vue-sonner'
import { getEnv } from '@/utils/env'

interface Props {
  open: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const feedbackText = ref('')
const isSubmitting = ref(false)

const closeModal = () => {
  emit('update:open', false)
  // Reset form after closing
  setTimeout(() => {
    feedbackText.value = ''
  }, 200)
}

const submitFeedback = async () => {
  if (!feedbackText.value.trim()) {
    toast.error('Please enter your feedback before submitting.')
    return
  }

  isSubmitting.value = true

  try {
    const baseUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')

    const response = await fetch(`${baseUrl}/api/users/me/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        message: feedbackText.value
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to submit feedback')
    }

    feedbackText.value = ''
    isSubmitting.value = false

    // Close modal first
    closeModal()

    // Then show success toast
    toast.success('Thank you! Your feedback has been submitted successfully.')
  } catch (error) {
    console.error('Error submitting feedback:', error)
    isSubmitting.value = false
    toast.error('Failed to submit feedback. Please try again later.')
  }
}
</script>

<template>
  <Dialog :open="props.open" @update:open="(value) => emit('update:open', value)">
    <DialogContent class="sm:max-w-[600px] lg:max-w-[700px]">
      <DialogHeader>
        <DialogTitle>Share Your Feedback</DialogTitle>
        <DialogDescription>
          Your feedback helps us improve DeployStack and make it better for everyone.
          We read every message and appreciate your input.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div class="space-y-2">
          <Label for="feedback">Your Feedback</Label>
          <Textarea
            id="feedback"
            v-model="feedbackText"
            placeholder="Tell us what you think, report issues, or suggest improvements..."
            rows="8"
            class="min-h-[200px] resize-none"
            :disabled="isSubmitting"
          />
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="closeModal"
          :disabled="isSubmitting"
        >
          Cancel
        </Button>
        <Button
          @click="submitFeedback"
          :disabled="isSubmitting"
        >
          <Spinner v-if="isSubmitting" class="mr-2" />
          {{ isSubmitting ? 'Sending...' : 'Send Feedback' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
