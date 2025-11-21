 
// Background Job Queue System Tables

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

// Job Batches - Group related jobs together
export const queueJobBatches = sqliteTable('queueJobBatches', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  type: text('type').notNull(),
  total_jobs: integer('total_jobs').notNull(),
  completed_jobs: integer('completed_jobs').notNull().default(0),
  failed_jobs: integer('failed_jobs').notNull().default(0),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  metadata: text('metadata'), // JSON
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completed_at: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  statusIdx: index('job_batches_status_idx').on(table.status),
  createdAtIdx: index('job_batches_created_at_idx').on(table.created_at),
}));

// Queue Jobs - Individual background jobs with retry logic
export const queueJobs = sqliteTable('queueJobs', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  type: text('type').notNull(),
  payload: text('payload').notNull(), // JSON
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  scheduled_for: integer('scheduled_for', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  attempts: integer('attempts').notNull().default(0),
  max_attempts: integer('max_attempts').notNull().default(3),
  error: text('error'),
  batch_id: text('batch_id').references(() => queueJobBatches.id, { onDelete: 'cascade' }),
  created_at: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updated_at: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  completed_at: integer('completed_at', { mode: 'timestamp' }),
}, (table) => ({
  statusScheduledIdx: index('jobs_status_scheduled_idx').on(table.status, table.scheduled_for),
  typeIdx: index('jobs_type_idx').on(table.type),
  createdAtIdx: index('jobs_created_at_idx').on(table.created_at),
  batchIdIdx: index('jobs_batch_id_idx').on(table.batch_id),
}));
