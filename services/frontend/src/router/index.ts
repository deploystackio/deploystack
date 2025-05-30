import { createRouter, createWebHistory } from 'vue-router'
import { useDatabaseStore } from '@/stores/database'

const routes = [
  {
    path: '/',
    redirect: '/login',
  },
  {
    path: '/setup',
    name: 'Setup',
    component: () => import('../views/Setup.vue'),
    meta: { requiresSetup: false }, // This route is accessible without setup
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/Register.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/plugin-demo',
    name: 'PluginDemo',
    component: () => import('../views/PluginDemo.vue'),
    meta: { requiresSetup: true },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Navigation guard to check database setup
router.beforeEach(async (to, from, next) => {
  const databaseStore = useDatabaseStore()

  // Skip setup check for the setup route itself
  if (to.name === 'Setup') {
    next()
    return
  }

  // Check if route requires setup
  if (to.meta.requiresSetup !== false) {
    try {
      // Check database status (use cache for performance)
      const isSetup = await databaseStore.checkDatabaseStatus(true)

      if (!isSetup) {
        // Database not setup, redirect to setup page
        next('/setup')
        return
      }
    } catch (error) {
      console.error('Failed to check database status:', error)
      // On error, redirect to setup page to be safe
      next('/setup')
      return
    }
  }

  next()
})

export default router
