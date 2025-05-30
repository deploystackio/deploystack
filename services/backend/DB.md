# Database Management

## Overview

DeployStack uses SQLite with Drizzle ORM for database operations. This combination provides excellent performance, type safety, and a modern, developer-friendly experience without the need for external database dependencies.

## Database Setup and Configuration

The backend server provides API endpoints for managing the initial database setup and checking its status.

### Database Status

You can check the current status of the database (whether it's configured and initialized) using the following endpoint:

- **Endpoint:** `GET /api/db/status`
- **Method:** `GET`
- **Response:** A JSON object indicating the database `configured` status (boolean), `initialized` status (boolean), and current `dialect` (e.g., "sqlite" or "postgres", or null if not configured).

### Initial Database Setup

To perform the initial setup of the database, use the following endpoint:

- **Endpoint:** `POST /api/db/setup`
- **Method:** `POST`
- **Request Body:** A JSON object specifying the database type and configuration.

**For SQLite:**
The server will automatically manage the database file location. The request body should be:

```json
{
  "type": "sqlite"
}
```

The SQLite database file will be created and stored at: `services/backend/persistent_data/database/deploystack.db`.

**For PostgreSQL:**
The request body should be:

```json
{
  "type": "postgres",
  "connectionString": "postgresql://username:password@host:port/mydatabase"
}
```

Replace the `connectionString` with your actual PostgreSQL connection URI.

**Important:** After the initial database setup via this API, you **must restart the backend server** for the changes to take full effect and for the application to connect to the newly configured database.

### Database Configuration File

The choice of database (SQLite or PostgreSQL) and its specific configuration (like the connection string for PostgreSQL) is stored in a JSON file located at:

- `services/backend/persistent_data/db.selection.json`

This file is automatically managed by the setup API. You typically do not need to edit it manually.

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
- **Important**: When adding foreign key relationships, update the dialect-specific schema files (e.g., `src/db/schema.sqlite.ts`) rather than the central `schema.ts` file, as Drizzle Kit uses these files for migration generation
- Never manually create migration files - always use `npm run db:generate` to ensure proper migration structure

## Inspecting the Database

You can inspect the SQLite database directly using various tools:

- **SQLite CLI**:

  ```bash
  sqlite3 services/backend/persistent_data/database/deploystack.db
  ```

  (Assuming the command is run from the project root directory)

- **Visual Tools**: [DB Browser for SQLite](https://sqlitebrowser.org/) or VSCode extensions like SQLite Viewer

## Troubleshooting

- If you get a "table already exists" error, check if you've already applied the migration
- For complex schema changes, you may need to create multiple migrations
- To reset the database, delete the `services/backend/persistent_data/database/deploystack.db` file and restart the server
