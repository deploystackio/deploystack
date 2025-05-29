CREATE TABLE IF NOT EXISTS "example-plugin_example_entities" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "created_at" INTEGER DEFAULT (strftime('%s', 'now')) NOT NULL
);
