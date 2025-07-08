-- Add MCP permissions to global_admin role
UPDATE roles 
SET permissions = '["users.list","users.view","users.edit","users.delete","users.create","roles.manage","system.admin","settings.view","settings.edit","settings.delete","teams.create","teams.view","teams.edit","teams.delete","teams.manage","team.members.view","team.members.manage","mcp.categories.view","mcp.categories.create","mcp.categories.edit","mcp.categories.delete","mcp.servers.global.view","mcp.servers.global.create","mcp.servers.global.edit","mcp.servers.global.delete","mcp.servers.team.view_all","mcp.versions.manage"]',
    updated_at = strftime('%s', 'now') * 1000
WHERE id = 'global_admin';
