<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  SettingsMenu,
  SettingsMenuGroup,
  SettingsMenuItem,
} from '@/components/ui/settings-menu'

interface Props {
  canChangePassword?: boolean
}

withDefaults(defineProps<Props>(), {
  canChangePassword: true
})

const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <SettingsMenu>
    <SettingsMenuGroup>
      <SettingsMenuItem
        to="/user/profile"
        :active="route.path === '/user/profile'"
      >
        {{ t('userAccount.navigation.profile') }}
      </SettingsMenuItem>
      <SettingsMenuItem
        v-if="canChangePassword"
        to="/user/security"
        :active="route.path === '/user/security'"
      >
        {{ t('userAccount.navigation.security') }}
      </SettingsMenuItem>
    </SettingsMenuGroup>
  </SettingsMenu>
</template>
