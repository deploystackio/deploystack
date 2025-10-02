import { type FastifyInstance } from 'fastify';

// Import modular route files
import listCategories from './categories/list';
import createCategory from './categories/create';
import updateCategory from './categories/update';
import deleteCategory from './categories/delete';

import listServers from './servers/list';
import getServer from './servers/get';
import searchServers from './servers/search';
import createGlobalServer from './servers/create-global';
import updateGlobalServer from './servers/update-global';
import deleteGlobalServer from './servers/delete-global';

import listTeamServers from './teams/list-servers';
import createTeamServer from './teams/create-server';
import updateTeamServer from './teams/update-server';
import deleteTeamServer from './teams/delete-server';

import listVersions from './versions/list';
import createVersion from './versions/create';
import updateVersion from './versions/update';

import getRepoInfo from './github/get-repo-info';

import installationsRoutes from './installations';
import userConfigurationsRoutes from './user-configurations';

export default async function mcpRoutes(server: FastifyInstance) {
  // Categories routes (global_admin only)
  await server.register(listCategories);
  await server.register(createCategory);
  await server.register(updateCategory);
  await server.register(deleteCategory);
  
  // Server routes (global)
  await server.register(listServers);
  await server.register(getServer);
  await server.register(searchServers);
  
  // Global server management (global_admin only)
  await server.register(createGlobalServer);
  await server.register(updateGlobalServer);
  await server.register(deleteGlobalServer);
  
  // Team server management
  await server.register(listTeamServers);
  await server.register(createTeamServer);
  await server.register(updateTeamServer);
  await server.register(deleteTeamServer);
  
  // Version management
  await server.register(listVersions);
  await server.register(createVersion);
  await server.register(updateVersion);
  
  // GitHub integration
  await server.register(getRepoInfo);
  
  // MCP Server Installations
  await server.register(installationsRoutes);
  
  // User Configurations
  await server.register(userConfigurationsRoutes);
}
