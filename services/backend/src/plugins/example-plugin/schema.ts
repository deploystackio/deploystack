import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Example table for the plugin (PostgreSQL)
export const exampleEntities = pgTable('example_entities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});
