import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration for PostgreSQL migrations
 *
 * DeployStack now exclusively uses PostgreSQL as its database.
 * This configuration generates migrations in the drizzle/migrations/ directory.
 *
 * Required PostgreSQL environment variables:
 * - POSTGRES_HOST (default: localhost)
 * - POSTGRES_PORT (default: 5432)
 * - POSTGRES_DATABASE (default: deploystack)
 * - POSTGRES_USER (default: postgres)
 * - POSTGRES_PASSWORD (required)
 * - POSTGRES_SSL (optional, set to 'true' to enable)
 *
 * Usage:
 * - Generate migrations: npm run db:generate
 * - Apply migrations: Automatic on server start
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT ? parseInt(process.env.POSTGRES_PORT, 10) : 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    database: process.env.POSTGRES_DATABASE || 'deploystack',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  strict: true,
  verbose: true
});
