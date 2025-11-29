import { eq, asc, and, count, isNull } from 'drizzle-orm';
import { getSchema } from '../db/index';
import type { AnyDatabase } from '../db';
import type { FastifyBaseLogger } from 'fastify';
import { nanoid } from 'nanoid';

// Types
export interface McpCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sort_order: number;
  created_at: Date;
}

export interface FeaturedCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  featured_server_count: number;
}

export interface CategoryWithServerCount {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  server_count: number;
  created_at: Date;
}

export interface CreateMcpCategoryRequest {
  name: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}

export interface UpdateMcpCategoryRequest {
  name?: string;
  description?: string;
  icon?: string;
  sort_order?: number;
}

export class McpCategoriesService {
  private readonly mcpCategories: ReturnType<typeof getSchema>['mcpCategories'];
  private readonly mcpServers: ReturnType<typeof getSchema>['mcpServers'];

  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {
    const schema = getSchema();
    this.mcpCategories = schema.mcpCategories;
    this.mcpServers = schema.mcpServers;
  }
  
  async getAllCategories(): Promise<McpCategory[]> {
    this.logger.debug({
      operation: 'get_all_categories'
    }, 'Getting all MCP categories');
    
    const categories = await this.db.select()
      .from(this.mcpCategories)
      .orderBy(asc(this.mcpCategories.sort_order), asc(this.mcpCategories.name));
    
    this.logger.info({
      operation: 'get_all_categories',
      categoriesFound: categories.length
    }, 'Retrieved MCP categories');
    
    return categories as McpCategory[];
  }
  
  async getCategoryById(categoryId: string): Promise<McpCategory | null> {
    this.logger.debug({
      operation: 'get_category_by_id',
      categoryId
    }, 'Getting MCP category by ID');
    
    const categories = await this.db.select()
      .from(this.mcpCategories)
      .where(eq(this.mcpCategories.id, categoryId))
      .limit(1);
    
    if (categories.length === 0) {
      this.logger.debug({
        operation: 'get_category_by_id',
        categoryId
      }, 'MCP category not found');
      return null;
    }
    
    return categories[0] as McpCategory;
  }
  
  async createCategory(data: CreateMcpCategoryRequest): Promise<McpCategory> {
    this.logger.debug({
      operation: 'create_category',
      name: data.name
    }, 'Creating MCP category');
    
    const categoryId = nanoid();
    const now = new Date();
    
    const categoryData = {
      id: categoryId,
      name: data.name,
      description: data.description || null,
      icon: data.icon || null,
      sort_order: data.sort_order || 0,
      created_at: now
    };
    
    await this.db.insert(this.mcpCategories).values(categoryData);
    
    this.logger.info({
      operation: 'create_category',
      categoryId,
      name: data.name
    }, 'Successfully created MCP category');
    
    return categoryData as McpCategory;
  }
  
  async updateCategory(categoryId: string, data: UpdateMcpCategoryRequest): Promise<McpCategory | null> {
    this.logger.debug({
      operation: 'update_category',
      categoryId
    }, 'Updating MCP category');
    
    const category = await this.getCategoryById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
    
    if (Object.keys(updateData).length === 0) {
      return category;
    }
    
    await this.db.update(this.mcpCategories).set(updateData).where(eq(this.mcpCategories.id, categoryId));
    
    this.logger.info({
      operation: 'update_category',
      categoryId,
      updatedFields: Object.keys(updateData)
    }, 'Successfully updated MCP category');
    
    return await this.getCategoryById(categoryId);
  }
  
  async deleteCategory(categoryId: string): Promise<boolean> {
    this.logger.debug({
      operation: 'delete_category',
      categoryId
    }, 'Deleting MCP category');

    const category = await this.getCategoryById(categoryId);
    if (!category) {
      return false;
    }

    await this.db.delete(this.mcpCategories).where(eq(this.mcpCategories.id, categoryId));

    this.logger.info({
      operation: 'delete_category',
      categoryId
    }, 'Successfully deleted MCP category');

    return true;
  }

  async getCategoriesWithFeaturedServers(): Promise<FeaturedCategory[]> {
    this.logger.debug({
      operation: 'get_categories_with_featured_servers'
    }, 'Getting categories with featured MCP servers');

    const results = await this.db
      .select({
        id: this.mcpCategories.id,
        name: this.mcpCategories.name,
        description: this.mcpCategories.description,
        icon: this.mcpCategories.icon,
        sort_order: this.mcpCategories.sort_order,
        featured_server_count: count(this.mcpServers.id)
      })
      .from(this.mcpCategories)
      .innerJoin(
        this.mcpServers,
        and(
          eq(this.mcpServers.category_id, this.mcpCategories.id),
          eq(this.mcpServers.featured, true),
          eq(this.mcpServers.visibility, 'global')
        )
      )
      .groupBy(
        this.mcpCategories.id,
        this.mcpCategories.name,
        this.mcpCategories.description,
        this.mcpCategories.icon,
        this.mcpCategories.sort_order
      )
      .orderBy(asc(this.mcpCategories.sort_order), asc(this.mcpCategories.name));

    this.logger.info({
      operation: 'get_categories_with_featured_servers',
      categoriesFound: results.length
    }, 'Retrieved categories with featured MCP servers');

    return results.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      sort_order: row.sort_order,
      featured_server_count: Number(row.featured_server_count)
    }));
  }

  async getAllCategoriesWithServerCount(): Promise<CategoryWithServerCount[]> {
    this.logger.debug({
      operation: 'get_all_categories_with_server_count'
    }, 'Getting all categories with global server count');

    const results = await this.db
      .select({
        id: this.mcpCategories.id,
        name: this.mcpCategories.name,
        description: this.mcpCategories.description,
        icon: this.mcpCategories.icon,
        sort_order: this.mcpCategories.sort_order,
        created_at: this.mcpCategories.created_at,
        server_count: count(this.mcpServers.id)
      })
      .from(this.mcpCategories)
      .leftJoin(
        this.mcpServers,
        and(
          eq(this.mcpServers.category_id, this.mcpCategories.id),
          isNull(this.mcpServers.owner_team_id)  // Only global servers
        )
      )
      .groupBy(
        this.mcpCategories.id,
        this.mcpCategories.name,
        this.mcpCategories.description,
        this.mcpCategories.icon,
        this.mcpCategories.sort_order,
        this.mcpCategories.created_at
      )
      .orderBy(asc(this.mcpCategories.sort_order), asc(this.mcpCategories.name));

    this.logger.info({
      operation: 'get_all_categories_with_server_count',
      categoriesFound: results.length
    }, 'Retrieved all categories with global server count');

    return results.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      sort_order: row.sort_order,
      server_count: Number(row.server_count),
      created_at: row.created_at
    }));
  }
}
