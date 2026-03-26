-- Initial database schema for ScrapEngine
-- Created by Drizzle ORM

CREATE TABLE IF NOT EXISTS api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  rate_limit_per_minute INTEGER DEFAULT 60,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_clients_key ON api_clients(api_key_hash);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (client_id) REFERENCES api_clients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webhooks_client ON webhooks(client_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(client_id, is_active);

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES api_clients(id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_client ON scrape_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON scrape_jobs(created_at);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL,
  job_id UUID,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  attempt INTEGER DEFAULT 1,
  delivered_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES scrape_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_job ON webhook_deliveries(job_id);
