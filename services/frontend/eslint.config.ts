import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      '**/src/components/ui/**',
      '**/src/lib/utils.ts'
    ]
  },

  // Apply Vue essential rules and TypeScript recommended rules first
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  skipFormatting,

  // Override rules for views directory - place this AFTER the base configurations
  {
    name: 'app/vue-views',
    files: ['**/src/views/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    }
  },
)
