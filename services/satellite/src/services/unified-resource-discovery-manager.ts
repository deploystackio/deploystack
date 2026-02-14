/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyBaseLogger } from 'fastify';
import { ServerStatusEntry } from './unified-tool-discovery-manager';

/**
 * Cached resource from an MCP server (hierarchical router uses namespaced URIs)
 */
export interface UnifiedCachedResource {
  serverName: string;           // Installation name (e.g., "excalidraw-john-abc123")
  originalUri: string;          // URI from server (e.g., "ui://excalidraw/mcp-app.html")
  namespacedUri: string;        // Namespaced URI (e.g., "excalidraw|ui://excalidraw/mcp-app.html")
  name: string;                 // Resource name
  description?: string;         // Optional description
  mimeType?: string;            // Optional MIME type
  annotations?: any;            // Optional annotations
  _meta?: Record<string, unknown>; // Resource metadata (e.g., MCP Apps UI config)
  transport: 'stdio' | 'http' | 'sse';
  serverSlug: string;           // Server slug (e.g., "excalidraw")
  discoveredAt?: Date;
}

/**
 * Cached resource template from an MCP server
 */
export interface UnifiedCachedResourceTemplate {
  serverName: string;
  originalUriTemplate: string;
  namespacedUriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: any;
  _meta?: Record<string, unknown>; // Template metadata (e.g., MCP Apps UI config)
  transport: 'stdio' | 'http' | 'sse';
  serverSlug: string;
  discoveredAt?: Date;
}

/**
 * Resource discovery callback signature
 */
export type ResourceDiscoveryCallback = (
  installationName: string,
  serverSlug: string,
  resources: Array<{ uri: string; name: string; description?: string; mimeType?: string; annotations?: any; _meta?: Record<string, unknown> }>,
  templates: Array<{ uriTemplate: string; name: string; description?: string; mimeType?: string; annotations?: any; _meta?: Record<string, unknown> }>,
  transport: 'stdio' | 'http' | 'sse'
) => void;

/**
 * UnifiedResourceDiscoveryManager
 *
 * Manages resource discovery and caching across stdio and HTTP/SSE MCP servers.
 * Resources are discovered alongside tools and cached for listing.
 * Resource content is never cached — always proxied on-demand.
 *
 * URI namespacing (hierarchical router only): serverSlug|originalUri
 * Instance router uses original URIs directly.
 */
export class UnifiedResourceDiscoveryManager {
  private resourceCache = new Map<string, UnifiedCachedResource>();
  private resourcesByServer = new Map<string, Set<string>>();

  private templateCache = new Map<string, UnifiedCachedResourceTemplate>();
  private templatesByServer = new Map<string, Set<string>>();

  private logger: FastifyBaseLogger;

  /**
   * Reference to server status map (shared with UnifiedToolDiscoveryManager)
   */
  private serverStatus: Map<string, ServerStatusEntry>;

  constructor(
    logger: FastifyBaseLogger,
    serverStatus: Map<string, ServerStatusEntry>
  ) {
    this.logger = logger.child({ component: 'UnifiedResourceDiscoveryManager' });
    this.serverStatus = serverStatus;
  }

  /**
   * Create namespaced URI: serverSlug|originalUri
   */
  private createNamespacedUri(serverSlug: string, originalUri: string): string {
    return `${serverSlug}|${originalUri}`;
  }

  /**
   * Parse namespaced URI back to { serverSlug, originalUri }
   */
  static parseNamespacedUri(namespacedUri: string): { serverSlug: string; originalUri: string } | null {
    const pipeIndex = namespacedUri.indexOf('|');
    if (pipeIndex <= 0) return null;

    return {
      serverSlug: namespacedUri.substring(0, pipeIndex),
      originalUri: namespacedUri.substring(pipeIndex + 1)
    };
  }

  /**
   * Update resources for a server (called after resource discovery)
   */
  updateServerResources(
    installationName: string,
    serverSlug: string,
    resources: Array<{ uri: string; name: string; description?: string; mimeType?: string; annotations?: any; _meta?: Record<string, unknown> }>,
    templates: Array<{ uriTemplate: string; name: string; description?: string; mimeType?: string; annotations?: any; _meta?: Record<string, unknown> }>,
    transport: 'stdio' | 'http' | 'sse'
  ): void {
    const discoveredAt = new Date();

    // Clear existing resources for this server
    this.clearServerResources(installationName);

    // Cache resources
    const resourceUriSet = new Set<string>();
    for (const resource of resources) {
      const namespacedUri = this.createNamespacedUri(serverSlug, resource.uri);

      const cached: UnifiedCachedResource = {
        serverName: installationName,
        originalUri: resource.uri,
        namespacedUri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        annotations: resource.annotations,
        ...(resource._meta ? { _meta: resource._meta } : {}),
        transport,
        serverSlug,
        discoveredAt
      };

      this.resourceCache.set(namespacedUri, cached);
      resourceUriSet.add(namespacedUri);
    }
    this.resourcesByServer.set(installationName, resourceUriSet);

    // Cache templates
    const templateUriSet = new Set<string>();
    for (const template of templates) {
      const namespacedUri = this.createNamespacedUri(serverSlug, template.uriTemplate);

      const cached: UnifiedCachedResourceTemplate = {
        serverName: installationName,
        originalUriTemplate: template.uriTemplate,
        namespacedUriTemplate: namespacedUri,
        name: template.name,
        description: template.description,
        mimeType: template.mimeType,
        annotations: template.annotations,
        ...(template._meta ? { _meta: template._meta } : {}),
        transport,
        serverSlug,
        discoveredAt
      };

      this.templateCache.set(namespacedUri, cached);
      templateUriSet.add(namespacedUri);
    }
    this.templatesByServer.set(installationName, templateUriSet);

    this.logger.info({
      operation: 'resources_updated',
      installation_name: installationName,
      server_slug: serverSlug,
      resource_count: resources.length,
      template_count: templates.length,
      transport
    }, `Updated ${resources.length} resources and ${templates.length} templates for ${installationName}`);
  }

  /**
   * Get all cached resources (filtered by server availability)
   */
  getAllResources(): UnifiedCachedResource[] {
    return Array.from(this.resourceCache.values()).filter(resource => {
      const status = this.serverStatus.get(resource.serverSlug);
      if (!status) return true;
      return status.status === 'online';
    });
  }

  /**
   * Get all cached resources without availability filtering
   */
  getAllResourcesUnfiltered(): UnifiedCachedResource[] {
    return Array.from(this.resourceCache.values());
  }

  /**
   * Get resource by namespaced URI
   */
  getResource(namespacedUri: string): UnifiedCachedResource | null {
    return this.resourceCache.get(namespacedUri) || null;
  }

  /**
   * Get resources for a specific server (by installation name)
   */
  getResourcesByServer(installationName: string): UnifiedCachedResource[] {
    const uriSet = this.resourcesByServer.get(installationName);
    if (!uriSet) return [];

    return Array.from(uriSet)
      .map(uri => this.resourceCache.get(uri))
      .filter((r): r is UnifiedCachedResource => r !== undefined);
  }

  /**
   * Get all cached resource templates (filtered by server availability)
   */
  getAllResourceTemplates(): UnifiedCachedResourceTemplate[] {
    return Array.from(this.templateCache.values()).filter(template => {
      const status = this.serverStatus.get(template.serverSlug);
      if (!status) return true;
      return status.status === 'online';
    });
  }

  /**
   * Get resource templates for a specific server
   */
  getResourceTemplatesByServer(installationName: string): UnifiedCachedResourceTemplate[] {
    const uriSet = this.templatesByServer.get(installationName);
    if (!uriSet) return [];

    return Array.from(uriSet)
      .map(uri => this.templateCache.get(uri))
      .filter((t): t is UnifiedCachedResourceTemplate => t !== undefined);
  }

  /**
   * Clear all resources and templates for a specific server
   */
  clearServerResources(installationName: string): void {
    let resourcesCleared = 0;
    let templatesCleared = 0;

    // Clear resources
    const resourceUris = this.resourcesByServer.get(installationName);
    if (resourceUris) {
      for (const uri of resourceUris) {
        if (this.resourceCache.delete(uri)) {
          resourcesCleared++;
        }
      }
      this.resourcesByServer.delete(installationName);
    }

    // Defensive: scan cache for orphaned resources
    for (const [uri, resource] of this.resourceCache.entries()) {
      if (resource.serverName === installationName) {
        this.resourceCache.delete(uri);
        resourcesCleared++;
      }
    }

    // Clear templates
    const templateUris = this.templatesByServer.get(installationName);
    if (templateUris) {
      for (const uri of templateUris) {
        if (this.templateCache.delete(uri)) {
          templatesCleared++;
        }
      }
      this.templatesByServer.delete(installationName);
    }

    // Defensive: scan template cache for orphaned templates
    for (const [uri, template] of this.templateCache.entries()) {
      if (template.serverName === installationName) {
        this.templateCache.delete(uri);
        templatesCleared++;
      }
    }

    if (resourcesCleared > 0 || templatesCleared > 0) {
      this.logger.info({
        operation: 'resources_cleared',
        installation_name: installationName,
        resources_cleared: resourcesCleared,
        templates_cleared: templatesCleared
      }, `Cleared ${resourcesCleared} resources and ${templatesCleared} templates for ${installationName}`);
    }
  }

  /**
   * Clear all cached resources and templates
   */
  clearAll(): void {
    const totalResources = this.resourceCache.size;
    const totalTemplates = this.templateCache.size;

    this.resourceCache.clear();
    this.resourcesByServer.clear();
    this.templateCache.clear();
    this.templatesByServer.clear();

    this.logger.info({
      operation: 'all_resources_cleared',
      resources_cleared: totalResources,
      templates_cleared: totalTemplates
    }, `Cleared all ${totalResources} resources and ${totalTemplates} templates`);
  }

  /**
   * Get statistics
   */
  getStats(): {
    total_resources: number;
    total_templates: number;
    servers_with_resources: number;
    resources_by_server: Record<string, number>;
  } {
    const resourcesByServer: Record<string, number> = {};
    for (const [serverName, uriSet] of this.resourcesByServer.entries()) {
      resourcesByServer[serverName] = uriSet.size;
    }

    return {
      total_resources: this.resourceCache.size,
      total_templates: this.templateCache.size,
      servers_with_resources: this.resourcesByServer.size,
      resources_by_server: resourcesByServer
    };
  }
}
