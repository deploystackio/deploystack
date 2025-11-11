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
    path: '/oauth/consent',
    name: 'OAuthConsent',
    component: () => import('../views/oauth/ConsentPage.vue'),
    meta: {
      requiresSetup: true,
      title: 'Authorize Application'
    },
  },
  // Dashboard temporarily disabled - redirect users to MCP Server instead
  // {
  //   path: '/dashboard',
  //   name: 'Dashboard',
  //   component: () => import('../views/Dashboard.vue'),
  //   meta: { requiresSetup: true },
  // },
  {
    path: '/plugin-demo',
    name: 'PluginDemo',
    component: () => import('../views/PluginDemo.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/user',
    name: 'User',
    component: () => import('../views/user/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/user/profile',
    name: 'UserProfile',
    component: () => import('../views/user/Profile.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/user/security',
    name: 'UserSecurity',
    component: () => import('../views/user/Security.vue'),
    meta: { requiresSetup: true },
  },
  // Legacy redirect for old URLs
  {
    path: '/user/account',
    redirect: '/user/profile'
  },
  {
    path: '/mcp-server',
    name: 'McpServer',
    component: () => import('../views/mcp-server/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/add',
    name: 'McpServerAdd',
    component: () => import('../views/mcp-server/add.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/view/:id',
    name: 'McpServerView',
    component: () => import('../views/mcp-server/view/[id].vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/installation/:id',
    name: 'McpServerInstallation',
    component: () => import('../views/mcp-server/installation/[id].vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/client-configuration',
    name: 'ClientConfiguration',
    component: () => import('../views/client-configuration/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/client-configuration/:client',
    name: 'ClientConfigurationDetail',
    component: () => import('../views/client-configuration/index.vue'),
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
    component: () => import('../views/credentials/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/credentials/:id',
    name: 'CredentialDetail',
    component: () => import('../views/credentials/[id].vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/teams',
    name: 'Teams',
    component: () => import('../views/teams/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/teams/manage',
    name: 'TeamsManageDefault',
    component: () => import('../views/teams/manage/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/teams/manage/:id',
    name: 'TeamManage',
    component: () => import('../views/teams/manage/[id].vue'),
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
        name: 'AdminSettingsIndex',
        component: () => import('../views/admin/settings/index.vue'),
      },
      {
        path: 'settings/:type',
        name: 'AdminSettings',
        component: () => import('../views/admin/settings/[type].vue'),
      },
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('../views/admin/Users.vue'),
      },
      {
        path: 'users/:id',
        name: 'AdminUserDetail',
        component: () => import('../views/admin/UserDetail.vue'),
      },
      {
        path: 'teams',
        name: 'AdminTeams',
        component: () => import('../views/admin/teams/index.vue'),
      },
      {
        path: 'teams/:id',
        name: 'AdminTeamDetail',
        component: () => import('../views/admin/teams/[id].vue'),
      },
      {
        path: 'teams/edit/:id',
        name: 'AdminTeamEdit',
        component: () => import('../views/admin/teams/edit/[id].vue'),
      },
      {
        path: 'mcp-server-catalog',
        name: 'AdminMcpServerCatalog',
        component: () => import('../views/admin/mcp-server-catalog/index.vue'),
      },
      {
        path: 'mcp-server-catalog/add',
        name: 'AdminMcpServerCatalogAdd',
        component: () => import('../views/admin/mcp-server-catalog/add.vue'),
      },
      {
        path: 'mcp-server-catalog/view/:id',
        name: 'AdminMcpServerCatalogView',
        component: () => import('../views/admin/mcp-server-catalog/view/[id].vue'),
      },
      {
        path: 'mcp-server-catalog/edit/:id',
        name: 'AdminMcpServerCatalogEdit',
        component: () => import('../views/admin/mcp-server-catalog/edit/[id].vue'),
      },
      {
        path: 'mcp-categories',
        name: 'AdminMcpCategories',
        component: () => import('../views/admin/mcp-categories/index.vue'),
      },
      {
        path: 'satellites',
        name: 'AdminSatellites',
        component: () => import('../views/admin/satellites/index.vue'),
      },
      {
        path: 'satellites/pairing',
        name: 'AdminSatellitePairing',
        component: () => import('../views/admin/satellites/pairing/index.vue'),
      },
      {
        path: 'jobs',
        name: 'AdminJobs',
        component: () => import('../views/admin/jobs/index.vue'),
      },
      {
        path: 'jobs/:id',
        name: 'AdminJobDetail',
        component: () => import('../views/admin/jobs/[id].vue'),
      },
      {
        path: 'jobs/batches/:batchId',
        name: 'AdminJobBatch',
        component: () => import('../views/admin/jobs/batches/[batchId].vue'),
      },
    ],
  },
  {
    path: '/unauthorized',
    name: 'Unauthorized',
    component: () => import('../views/Unauthorized.vue'),
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

  // If user is logged in and trying to access Login or Register, redirect to MCP Server
  if (currentUser && (to.name === 'Login' || to.name === 'Register')) {
    next('/mcp-server');
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
      next({ name: 'Unauthorized' })
      return
    }
  }

  next()
})

export default router
