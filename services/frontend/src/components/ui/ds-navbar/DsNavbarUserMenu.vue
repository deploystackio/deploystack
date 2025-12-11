<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { User as UserIcon, LogOut, ChevronDown } from 'lucide-vue-next'

interface Props {
  userName: string
  userEmail: string
  userLoading: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'go-to-account'): void
  (e: 'logout'): void
}>()

const { t } = useI18n()

const getUserInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        class="h-9 gap-2 px-2"
      >
        <Avatar class="h-7 w-7">
          <AvatarImage src="/images/user.jpg" :alt="userName" />
          <AvatarFallback class="text-xs">
            {{ userLoading ? '..' : getUserInitials(userName || userEmail) }}
          </AvatarFallback>
        </Avatar>
        <div class="hidden lg:flex flex-col items-start text-left">
          <span class="text-sm font-medium truncate max-w-[120px]">
            {{ userName || userEmail }}
          </span>
        </div>
        <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-56">
      <div class="px-2 py-1.5">
        <p class="text-sm font-medium truncate">{{ userName || userEmail }}</p>
        <p v-if="userName" class="text-xs text-muted-foreground truncate">{{ userEmail }}</p>
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem @click="emit('go-to-account')" class="gap-2 cursor-pointer">
        <UserIcon class="h-4 w-4" />
        {{ t('sidebar.user.account') }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @click="emit('logout')" class="gap-2 cursor-pointer text-destructive focus:text-destructive">
        <LogOut class="h-4 w-4" />
        {{ t('sidebar.user.logout') }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
