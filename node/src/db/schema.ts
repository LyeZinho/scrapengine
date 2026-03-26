import {
  pgTable,
  text,
  uuid,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  foreignKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const apiClients = pgTable(
  'api_clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    apiKeyHash: text('api_key_hash').notNull().unique(),
    isActive: boolean('is_active').default(true),
    rateLimitPerMinute: integer('rate_limit_per_minute').default(60),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    apiKeyIdx: index('idx_api_clients_key').on(table.apiKeyHash),
  })
);

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id').notNull(),
    url: text('url').notNull(),
    secret: text('secret').notNull(),
    events: text('events').array().default([]),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    clientIdx: index('idx_webhooks_client').on(table.clientId),
    clientActiveIdx: index('idx_webhooks_active').on(
      table.clientId,
      table.isActive
    ),
    clientFk: foreignKey({
      columns: [table.clientId],
      foreignColumns: [apiClients.id],
    }).onDelete('cascade'),
  })
);

export const scrapeJobs = pgTable(
  'scrape_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id').notNull(),
    url: text('url').notNull(),
    status: text('status').notNull().default('pending'),
    progress: integer('progress').default(0),
    result: jsonb('result'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').defaultNow(),
    startedAt: timestamp('started_at'),
    completedAt: timestamp('completed_at'),
  },
  (table) => ({
    clientIdx: index('idx_jobs_client').on(table.clientId),
    statusIdx: index('idx_jobs_status').on(table.status),
    createdIdx: index('idx_jobs_created').on(table.createdAt),
    clientFk: foreignKey({
      columns: [table.clientId],
      foreignColumns: [apiClients.id],
    }),
  })
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    webhookId: uuid('webhook_id').notNull(),
    jobId: uuid('job_id'),
    event: text('event').notNull(),
    payload: jsonb('payload').notNull(),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    attempt: integer('attempt').default(1),
    deliveredAt: timestamp('delivered_at').defaultNow(),
  },
  (table) => ({
    webhookIdx: index('idx_deliveries_webhook').on(table.webhookId),
    jobIdx: index('idx_deliveries_job').on(table.jobId),
    webhookFk: foreignKey({
      columns: [table.webhookId],
      foreignColumns: [webhooks.id],
    }).onDelete('cascade'),
    jobFk: foreignKey({
      columns: [table.jobId],
      foreignColumns: [scrapeJobs.id],
    }),
  })
);

export const apiClientsRelations = relations(apiClients, ({ many }) => ({
  webhooks: many(webhooks),
  jobs: many(scrapeJobs),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  client: one(apiClients, {
    fields: [webhooks.clientId],
    references: [apiClients.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const scrapeJobsRelations = relations(scrapeJobs, ({ one, many }) => ({
  client: one(apiClients, {
    fields: [scrapeJobs.clientId],
    references: [apiClients.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(
  webhookDeliveries,
  ({ one }) => ({
    webhook: one(webhooks, {
      fields: [webhookDeliveries.webhookId],
      references: [webhooks.id],
    }),
    job: one(scrapeJobs, {
      fields: [webhookDeliveries.jobId],
      references: [scrapeJobs.id],
    }),
  })
);
