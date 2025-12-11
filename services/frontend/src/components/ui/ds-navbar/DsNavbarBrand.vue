<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Users, ChevronDown, Check } from 'lucide-vue-next'
import type { Team } from '@/services/teamService'

interface Props {
  teams: Team[]
  selectedTeam: Team | null
  teamsLoading: boolean
  teamsError: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'select-team', team: Team): void
}>()

const router = useRouter()
const { t } = useI18n()

const goToHome = () => {
  router.push('/dashboard')
}
</script>

<template>
  <div class="flex items-center gap-3">
    <button
      @click="goToHome"
      class="flex shrink-0 items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
    >
      <img
        src="/logo-black.png"
        alt="DeployStack"
        class="h-8 w-auto"
      />
    </button>

    <span class="text-xl text-muted-foreground/50">/</span>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          class="h-9 gap-2 px-3"
          :disabled="teamsLoading"
        >
          <Users class="h-4 w-4 shrink-0" />
          <span class="max-w-[150px] truncate font-medium">
            {{ selectedTeam?.name || t('sidebar.teams.selectTeam') }}
          </span>
          <ChevronDown class="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="w-56">
        <div v-if="teamsLoading" class="p-2 text-sm text-muted-foreground">
          {{ t('sidebar.teams.loading') }}
        </div>
        <div v-else-if="teamsError" class="p-2 text-sm text-destructive">
          {{ teamsError }}
        </div>
        <div v-else-if="teams.length === 0" class="p-2 text-sm text-muted-foreground">
          {{ t('sidebar.teams.noTeams') }}
        </div>
        <template v-else>
          <DropdownMenuItem
            v-for="team in teams"
            :key="team.id"
            @click="emit('select-team', team)"
            class="gap-2 cursor-pointer"
          >
            <div class="flex size-6 items-center justify-center rounded-sm border shrink-0">
              <Users class="size-3" />
            </div>
            <div class="flex flex-1 flex-col">
              <span class="font-medium">{{ team.name }}</span>
              <span v-if="team.description" class="text-xs text-muted-foreground truncate">
                {{ team.description }}
              </span>
            </div>
            <Check
              v-if="selectedTeam?.id === team.id"
              class="h-4 w-4 shrink-0"
            />
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
