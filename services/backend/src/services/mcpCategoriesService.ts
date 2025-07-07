import { eq, asc } from 'drizzle-orm';
import { mcpCategories } from '../db/schema.sqlite';
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
  constructor(
    private db: AnyDatabase,
    private logger: FastifyBaseLogger
  ) {}
  
  async getAllCategories(): Promise<McpCategory[]> {
    this.logger.debug({
      operation: 'get_all_categories'
    }, 'Getting all MCP categories');
    
    const categories = await this.db.select()
      .from(mcpCategories)
      .orderBy(asc(mcpCategories.sort_order), asc(mcpCategories.name));
    
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
      .from(mcpCategories)
      .where(eq(mcpCategories.id, categoryId))
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
    
    await this.db.insert(mcpCategories).values(categoryData);
    
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
    
    await this.db.update(mcpCategories).set(updateData).where(eq(mcpCategories.id, categoryId));
    
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
    
    await this.db.delete(mcpCategories).where(eq(mcpCategories.id, categoryId));
    
    this.logger.info({
      operation: 'delete_category',
      categoryId
    }, 'Successfully deleted MCP category');
    
    return true;
  }
}
