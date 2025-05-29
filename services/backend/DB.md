# Database Management

## Overview

DeployStack uses SQLite with Drizzle ORM for database operations. This combination provides excellent performance, type safety, and a modern, developer-friendly experience without the need for external database dependencies.

## Key Components

- **SQLite**: Embedded SQL database engine
- **Drizzle ORM**: Type-safe ORM for TypeScript
- **Drizzle Kit**: Schema migration tool for Drizzle ORM

## Database Structure

The database schema is defined in `src/db/schema.ts`. It contains:

1. Base schema tables (core application)
2. Plugin tables (dynamically loaded)

## Making Schema Changes

Follow these steps to add or modify database tables:

1. **Modify Schema Definition**

   Edit `src/db/schema.ts` to add or modify tables:

   ```typescript
   // Example: Adding a new projects table
   export const projects = sqliteTable('projects', {
     id: text('id').primaryKey(),
     name: text('name').notNull(),
     description: text('description'),
     userId: text('user_id').references(() => users.id),
     createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
     updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(strftime('%s', 'now'))`),
   });

   // Don't forget to add it to baseSchema
   export const baseSchema = {
     users,
     projects, // Add your new table here
   };
   ```

2. **Generate Migration**

   Run the migration generation command:

   ```bash
   npm run db:generate
   ```

   This will create SQL migration files in `drizzle/migrations/` based on your schema changes.

3. **Review Migrations**

   Examine the generated SQL files in `drizzle/migrations/` to ensure they match your intended changes.

4. **Apply Migrations**

   Either:
   - Restart the application (migrations are applied on startup)
   - Run migrations directly:

     ```bash
     npm run db:up
     ```

5. **Use the New Schema**

   Update your application code to use the new tables:

   ```typescript
   // Example: Using the new table in a route
   app.get('/api/projects', async (request, reply) => {
     const projects = await request.db.select().from(schema.projects).all();
     return projects;
   });
   ```

## Plugin Database Extensions

Plugins can add their own tables through the `databaseExtension` property:

1. Define tables in the plugin's `schema.ts` file
2. Include tables in the plugin's `databaseExtension.tables` array
3. Implement `onDatabaseInit()` for seeding or initialization

Tables defined by plugins are automatically created when the plugin is loaded and initialized.

## Migration Management

- Migrations are tracked in a `__drizzle_migrations` table
- Only new migrations are applied when the server starts
- Migrations are applied in a transaction to ensure consistency

## Development Workflow

1. Make schema changes in `src/db/schema.ts`
2. Generate migrations with `npm run db:generate`
3. Restart the server to apply migrations
4. Update application code to use the modified schema

## Best Practices

- Use meaningful column names and consistent naming conventions
- Add appropriate indexes for columns that will be frequently queried
- Include proper foreign key constraints for relational data
- Add explicit types for all columns
- Always use migrations for schema changes in development and production

## Inspecting the Database

You can inspect the SQLite database directly using various tools:

- **SQLite CLI**:

  ```bash
  sqlite3 ./data/deploystack.db
  ```

- **Visual Tools**: [DB Browser for SQLite](https://sqlitebrowser.org/) or VSCode extensions like SQLite Viewer

## Troubleshooting

- If you get a "table already exists" error, check if you've already applied the migration
- For complex schema changes, you may need to create multiple migrations
- To reset the database, delete the `./data/deploystack.db` file and restart the server
