<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Crown, Shield, Trash2 } from 'lucide-vue-next'

const { t } = useI18n()

interface DisplayMember {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

interface Props {
  member: DisplayMember
  canManageMembers: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'remove-member': [member: DisplayMember]
  'edit-role': [member: DisplayMember]
}>()

// Helper functions
const getRoleIcon = (role: string) => {
  switch (role) {
    case 'team_owner':
      return Crown
    case 'team_admin':
      return Shield
    default:
      return Users
  }
}

const getRoleBadgeVariant = (role: string) => {
  switch (role) {
    case 'team_owner':
      return 'default'
    case 'team_admin':
      return 'secondary'
    default:
      return 'outline'
  }
}

const getRoleLabel = (role: string) => {
  switch (role) {
    case 'team_owner':
      return t('teams.manage.members.roles.owner', 'Owner')
    case 'team_admin':
      return t('teams.manage.members.roles.admin', 'Administrator')
    default:
      return t('teams.manage.members.roles.user', 'User')
  }
}

const formatJoinDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const handleRemoveMember = () => {
  emit('remove-member', props.member)
}

const handleEditRole = () => {
  emit('edit-role', props.member)
}
</script>

<template>
  <div class="flex items-center justify-between p-4 border rounded-lg bg-white dark:bg-card hover:bg-muted/50 transition-colors">
    <div class="flex items-center gap-4">
      <!-- Avatar placeholder -->
      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Users class="h-5 w-5 text-muted-foreground" />
      </div>

      <div>
        <div class="flex items-center gap-2">
          <p class="font-medium">{{ member.name }}</p>
          <Badge :variant="getRoleBadgeVariant(member.role)" class="gap-1">
            <component :is="getRoleIcon(member.role)" class="h-3 w-3" />
            {{ getRoleLabel(member.role) }}
          </Badge>
        </div>
        <p class="text-sm text-muted-foreground">{{ member.email }}</p>
        <p class="text-xs text-muted-foreground">
          Joined {{ formatJoinDate(member.joinedAt) }}
        </p>
      </div>
    </div>

    <!-- Member Actions -->
    <div v-if="canManageMembers && member.role !== 'team_owner'" class="flex items-center gap-2">
      <Button variant="outline" size="sm" @click="handleEditRole">
        Edit Role
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="text-destructive hover:text-destructive"
        @click="handleRemoveMember"
      >
        <Trash2 class="h-4 w-4 mr-1" />
        Remove
      </Button>
    </div>
  </div>
</template>