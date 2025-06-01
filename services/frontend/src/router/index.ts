import { createRouter, createWebHistory } from 'vue-router'
import { useDatabaseStore } from '@/stores/database'
import { UserService } from '@/services/userService'

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
    path: '/logout',
    name: 'Logout',
    component: () => import('../views/Logout.vue'),
    meta: { requiresSetup: true }, // Or false, depending on whether logout should be accessible if setup isn't complete
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/Dashboard.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/plugin-demo',
    name: 'PluginDemo',
    component: () => import('../views/PluginDemo.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/user/account',
    name: 'UserAccount',
    component: () => import('../views/UserAccount.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server',
    name: 'McpServer',
    component: () => import('../views/McpServer.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/provider',
    name: 'Provider',
    component: () => import('../views/Provider.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/credentials',
    name: 'Credentials',
    component: () => import('../views/Credentials.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/admin',
    meta: { 
      requiresSetup: true,
      requiresRole: 'global_admin'
    },
    children: [
      {
        path: 'settings',
        name: 'AdminSettings',
        component: () => import('../views/GlobalSettings.vue'),
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFound.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Navigation guard to check database setup
router.beforeEach(async (to, from, next) => {
  const databaseStore = useDatabaseStore()
  const user = await UserService.getCurrentUser()

  // If user is logged in and trying to access Login or Register, redirect to Dashboard
  if (user) {
    if (to.name === 'Login' || to.name === 'Register') {
      next('/dashboard')
      return
    }
  }

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

  // Check role requirements
  if (to.meta.requiresRole) {
    const currentUser = await UserService.getCurrentUser()
    if (!currentUser || currentUser.role_id !== to.meta.requiresRole) {
      next({ name: 'NotFound' })
      return
    }
  }

  next()
})

export default router
