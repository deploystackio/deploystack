import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useDatabaseStore } from '@/stores/database'
import { UserService } from '@/services/userService'
import { getEnv } from '@/utils/env'

// Validate return_to URL is a safe redirect (must be our backend OAuth URL)
const isValidReturnTo = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url)
    const backendUrl = getEnv('VITE_DEPLOYSTACK_BACKEND_URL')
    if (!backendUrl) return false

    const backendParsed = new URL(backendUrl)
    // Only allow redirects to our backend's OAuth endpoints
    return parsedUrl.origin === backendParsed.origin &&
           parsedUrl.pathname.startsWith('/api/oauth2/')
  } catch {
    return false
  }
}

const routes: RouteRecordRaw[] = [
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
  {
    path: '/oauth/authorize',
    name: 'OAuthAuthorize',
    component: () => import('../views/oauth/AuthorizePage.vue'),
    meta: {
      requiresSetup: true,
      title: 'Authorize MCP Access'
    },
  },
  {
    path: '/oauth/callback-complete',
    name: 'OAuthCallbackComplete',
    component: () => import('../views/oauth/OAuthCallbackComplete.vue'),
    meta: {
      requiresSetup: false,
      title: 'Authorization Complete'
    },
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/dashboard/index.vue'),
    meta: { requiresSetup: true },
  },
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
    path: '/mcp-server/search',
    name: 'McpServerSearch',
    component: () => import('../views/mcp-server/search.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/install/:id',
    name: 'McpServerInstallById',
    component: () => import('../views/mcp-server/install/[id].vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/install',
    name: 'McpServerInstall',
    redirect: '/mcp-server/search',
  },
  {
    path: '/mcp-server/view/:id',
    name: 'McpServerView',
    component: () => import('../views/mcp-server/view/[id].vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/installation/:id',
    redirect: (to) => {
      return {
        name: 'McpServerInstallationGeneral',
        params: to.params
      }
    }
  },
  {
    path: '/mcp-server/installation/:id/general',
    name: 'McpServerInstallationGeneral',
    component: () => import('../views/mcp-server/installation/[id]/general.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/installation/:id/tools',
    name: 'McpServerInstallationTools',
    component: () => import('../views/mcp-server/installation/[id]/tools.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/installation/:id/requests',
    name: 'McpServerInstallationRequests',
    component: () => import('../views/mcp-server/installation/[id]/requests.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/installation/:id/logs',
    name: 'McpServerInstallationLogs',
    component: () => import('../views/mcp-server/installation/[id]/logs.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/installation/:id/config',
    name: 'McpServerInstallationConfig',
    component: () => import('../views/mcp-server/installation/[id]/config.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/installation/:id/danger-zone',
    name: 'McpServerInstallationDangerZone',
    component: () => import('../views/mcp-server/installation/[id]/danger-zone.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/featured',
    name: 'McpServerFeatured',
    component: () => import('../views/mcp-server/featured.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/catalog',
    name: 'McpServerCatalogIndex',
    component: () => import('../views/mcp-server/catalog/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/mcp-server/catalog/:categoryId',
    name: 'McpServerCatalog',
    component: () => import('../views/mcp-server/catalog/[categoryId].vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/deploy',
    name: 'Deploy',
    component: () => import('../views/deploy/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/deploy/create',
    name: 'DeployCreate',
    component: () => import('../views/deploy/create.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/client-configuration',
    name: 'ClientConfiguration',
    component: () => import('../views/client-configuration/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/client-configuration/:category/:client',
    name: 'ClientConfigurationDetail',
    component: () => import('../views/client-configuration/index.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('../views/statistics/index.vue'),
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
    redirect: (to) => ({
      path: `/teams/manage/${to.params.id}/general`,
      query: to.query
    }),
  },
  {
    path: '/teams/manage/:id/general',
    name: 'TeamManageGeneral',
    component: () => import('../views/teams/manage/[id]/general.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/teams/manage/:id/members',
    name: 'TeamManageMembers',
    component: () => import('../views/teams/manage/[id]/members.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/teams/manage/:id/mcp-servers',
    name: 'TeamManageMcpServers',
    component: () => import('../views/teams/manage/[id]/mcp-servers.vue'),
    meta: { requiresSetup: true },
  },
  {
    path: '/teams/manage/:id/usage',
    name: 'TeamManageUsage',
    component: () => import('../views/teams/manage/[id]/usage.vue'),
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
        component: () => import('../views/admin/users/index.vue'),
      },
      // Redirect base path to /general
      {
        path: 'users/:id',
        redirect: (to) => {
          return {
            name: 'AdminUserDetailGeneral',
            params: to.params
          }
        }
      },
      // General tab (default)
      {
        path: 'users/:id/general',
        name: 'AdminUserDetailGeneral',
        component: () => import('../views/admin/users/[id]/general.vue'),
      },
      // Teams tab
      {
        path: 'users/:id/teams',
        name: 'AdminUserDetailTeams',
        component: () => import('../views/admin/users/[id]/teams.vue'),
      },
      {
        path: 'teams',
        name: 'AdminTeams',
        component: () => import('../views/admin/teams/index.vue'),
      },
      // Redirect base path to /general
      {
        path: 'teams/:id',
        redirect: (to) => {
          return {
            name: 'AdminTeamDetailGeneral',
            params: to.params
          }
        }
      },
      // General tab (default)
      {
        path: 'teams/:id/general',
        name: 'AdminTeamDetailGeneral',
        component: () => import('../views/admin/teams/[id]/general.vue'),
      },
      // Limits tab
      {
        path: 'teams/:id/limits',
        name: 'AdminTeamDetailLimits',
        component: () => import('../views/admin/teams/[id]/limits.vue'),
      },
      // Members tab
      {
        path: 'teams/:id/members',
        name: 'AdminTeamDetailMembers',
        component: () => import('../views/admin/teams/[id]/members.vue'),
      },
      // MCP Servers tab
      {
        path: 'teams/:id/mcp-server',
        name: 'AdminTeamDetailMcpServer',
        component: () => import('../views/admin/teams/[id]/mcp-server.vue'),
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
        redirect: (to) => ({
          name: 'AdminMcpCatalogViewGeneral',
          params: { id: to.params.id }
        }),
      },
      {
        path: 'mcp-server-catalog/view/:id/general',
        name: 'AdminMcpCatalogViewGeneral',
        component: () => import('../views/admin/mcp-server-catalog/view/[id]/general.vue'),
      },
      {
        path: 'mcp-server-catalog/view/:id/installations',
        name: 'AdminMcpCatalogViewInstallations',
        component: () => import('../views/admin/mcp-server-catalog/view/[id]/installations.vue'),
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
        path: 'satellites/:id',
        redirect: (to) => `/admin/satellites/${to.params.id}/general`,
        children: [
          {
            path: 'general',
            name: 'AdminSatelliteGeneral',
            component: () => import('../views/admin/satellites/[id]/general.vue'),
          },
          {
            path: 'commands',
            name: 'AdminSatelliteCommands',
            component: () => import('../views/admin/satellites/[id]/commands.vue'),
          },
          {
            path: 'heartbeats',
            name: 'AdminSatelliteHeartbeats',
            component: () => import('../views/admin/satellites/[id]/heartbeats.vue'),
          },
        ],
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

  // If user is logged in and trying to access Login or Register, handle redirect
  if (currentUser && (to.name === 'Login' || to.name === 'Register')) {
    // Check for return_to in query params (from OAuth flow)
    const returnTo = to.query.return_to as string | undefined

    // Also check localStorage for return_to (from GitHub OAuth flow)
    const storedReturnTo = localStorage.getItem('oauth_return_to')

    // Use query param first, then localStorage
    const targetReturnTo = returnTo || storedReturnTo

    if (targetReturnTo && isValidReturnTo(targetReturnTo)) {
      // Clear stored return_to
      localStorage.removeItem('oauth_return_to')
      // Redirect to the OAuth URL (full page redirect since it's a backend URL)
      window.location.href = targetReturnTo
      return
    }

    // Clear any stale stored return_to
    if (storedReturnTo) {
      localStorage.removeItem('oauth_return_to')
    }

    // Default redirect to dashboard
    next('/dashboard')
    return
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
