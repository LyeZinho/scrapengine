-- Migration: 001_initial_schema.sql
-- Adds API clients, webhooks, scrape_jobs, and webhook_deliveries tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- API Clients table
-- Stores registered API clients with authentication and rate limiting
CREATE TABLE IF NOT EXISTS api_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    rate_limit_per_minute INT DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Webhooks table
-- Stores webhook endpoints for each client to receive job notifications
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES api_clients(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scrape Jobs table
-- Tracks all scraping jobs with their status and results
CREATE TABLE IF NOT EXISTS scrape_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES api_clients(id),
    url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INT DEFAULT 0,
    result JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Webhook Deliveries log
-- Logs all webhook delivery attempts for audit and retry purposes
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
    job_id UUID REFERENCES scrape_jobs(id),
    event TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INT,
    response_body TEXT,
    attempt INT DEFAULT 1,
    delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_clients_key ON api_clients(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_webhooks_client ON webhooks(client_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(client_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_jobs_client ON scrape_jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON scrape_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON scrape_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_job ON webhook_deliveries(job_id);
