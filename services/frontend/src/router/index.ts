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
    path: '/verify-email',
    name: 'VerifyEmail',
    component: () => import('../views/VerifyEmail.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('../views/ForgotPassword.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('../views/ResetPassword.vue'),
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
        redirect: '/admin/settings/global'
      },
      {
        path: 'settings/:groupId',
        name: 'AdminSettings',
        component: () => import('../views/admin/GlobalSettings.vue'),
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('../views/admin/Users.vue'), // Assuming the new component will be in views/admin/
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

  // Define public routes that don't need user authentication checks
  const publicRoutes = ['Setup', 'Login', 'Register', 'VerifyEmail', 'ForgotPassword', 'ResetPassword']
  const isPublicRoute = publicRoutes.includes(to.name as string)

  // Attempt to get current user status early
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentUser: any = null;
  try {
    // Avoid force refreshing cache here unless necessary, to use existing session info
    currentUser = await UserService.getCurrentUser();
  } catch (error) {
    console.error('Failed to get current user in guard:', error);
    // currentUser remains null, proceed as unauthenticated for safety
  }

  // If user is logged in and trying to access Login or Register, redirect to Dashboard
  if (currentUser && (to.name === 'Login' || to.name === 'Register')) {
    next('/dashboard');
    return;
  }

  // Skip setup check for the setup route itself
  if (to.name === 'Setup') {
    next()
    return
  }

  // For public routes (Login/Register) that are NOT being accessed by an already logged-in user
  if (isPublicRoute) {
    // This block is now for genuinely unauthenticated users accessing Login/Register
    // or for the Setup page (though Setup is handled above, this keeps structure)
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

    // For public routes, proceed without further user checks if not already redirected
    next()
    return
  }

  // For protected routes (user is not null or trying to access login/register when logged in)
  // If not logged in and trying to access a protected route, redirect to login
  if (!currentUser && !isPublicRoute && to.name !== 'Setup') {
    next('/login');
    return;
  }

  // Check if route requires setup (for protected routes, currentUser should exist here)
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

  // Check role requirements (reuse the currentUser from above)
  if (to.meta.requiresRole) {
    // currentUser should be valid here due to the redirect above if null
    if (!currentUser || currentUser.role_id !== to.meta.requiresRole) {
      next({ name: 'NotFound' }) // Or redirect to an 'Unauthorized' page
      return
    }
  }

  next()
})

export default router
