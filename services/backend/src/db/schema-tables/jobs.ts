
// Background Job Queue System Tables

import { pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { nanoid } from 'nanoid';

// Job Batches - Group related jobs together
export const queueJobBatches = pgTable('queueJobBatches', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  type: text('type').notNull(),
  total_jobs: integer('total_jobs').notNull(),
  completed_jobs: integer('completed_jobs').notNull().default(0),
  failed_jobs: integer('failed_jobs').notNull().default(0),
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  metadata: text('metadata'), // JSON
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  statusIdx: index('job_batches_status_idx').on(table.status),
  createdAtIdx: index('job_batches_created_at_idx').on(table.created_at),
}));

// Queue Jobs - Individual background jobs with retry logic
export const queueJobs = pgTable('queueJobs', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  type: text('type').notNull(),
  payload: text('payload').notNull(), // JSON
  status: text('status', { enum: ['pending', 'processing', 'completed', 'failed'] }).notNull().default('pending'),
  scheduled_for: timestamp('scheduled_for', { withTimezone: true }).notNull().defaultNow(),
  attempts: integer('attempts').notNull().default(0),
  max_attempts: integer('max_attempts').notNull().default(3),
  error: text('error'),
  batch_id: text('batch_id').references(() => queueJobBatches.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  statusScheduledIdx: index('jobs_status_scheduled_idx').on(table.status, table.scheduled_for),
  typeIdx: index('jobs_type_idx').on(table.type),
  createdAtIdx: index('jobs_created_at_idx').on(table.created_at),
  batchIdIdx: index('jobs_batch_id_idx').on(table.batch_id),
}));
