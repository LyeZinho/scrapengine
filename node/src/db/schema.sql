-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sources table
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    url_pattern TEXT NOT NULL,
    schema_type TEXT NOT NULL DEFAULT 'JobPosting',
    scrape_interval_minutes INT NOT NULL DEFAULT 240,
    is_active BOOLEAN DEFAULT true,
    last_scrape_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    external_id TEXT,
    title TEXT NOT NULL,
    company TEXT,
    location TEXT,
    description TEXT,
    url TEXT NOT NULL,
    salary_min INT,
    salary_max INT,
    job_type TEXT,
    remote BOOLEAN DEFAULT false,
    hash_content TEXT NOT NULL UNIQUE,
    notified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scrape logs table
CREATE TABLE scrape_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES sources(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    items_found INT DEFAULT 0,
    error_message TEXT,
    duration_ms INT,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_jobs_hash ON jobs(hash_content);
CREATE INDEX idx_jobs_source ON jobs(source_id);
CREATE INDEX idx_jobs_external ON jobs(source_id, external_id);
CREATE INDEX idx_logs_source ON scrape_logs(source_id);
CREATE INDEX idx_logs_date ON scrape_logs(scraped_at);
