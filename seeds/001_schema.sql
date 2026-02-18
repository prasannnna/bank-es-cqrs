CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- EVENT STORE
CREATE TABLE IF NOT EXISTS events (
  event_id UUID PRIMARY KEY NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL,
  aggregate_type VARCHAR(255) NOT NULL,
  event_type VARCHAR(255) NOT NULL,
  event_data JSONB NOT NULL,
  event_number INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE events
  ADD CONSTRAINT unique_aggregate_event_number UNIQUE (aggregate_id, event_number);

CREATE INDEX IF NOT EXISTS idx_events_aggregate_id ON events(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

-- SNAPSHOTS
CREATE TABLE IF NOT EXISTS snapshots (
  snapshot_id UUID PRIMARY KEY NOT NULL,
  aggregate_id VARCHAR(255) NOT NULL UNIQUE,
  snapshot_data JSONB NOT NULL,
  last_event_number INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate_id ON snapshots(aggregate_id);

-- READ MODEL: ACCOUNT SUMMARY
CREATE TABLE IF NOT EXISTS account_summaries (
  account_id VARCHAR(255) PRIMARY KEY NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  balance DECIMAL(19,4) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  status VARCHAR(50) NOT NULL,
  version BIGINT NOT NULL
);

-- READ MODEL: TRANSACTION HISTORY
CREATE TABLE IF NOT EXISTS transaction_history (
  transaction_id VARCHAR(255) PRIMARY KEY NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(19,4) NOT NULL,
  description TEXT,
  timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tx_account_id ON transaction_history(account_id);
CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transaction_history(timestamp);

-- PROJECTOR CHECKPOINTS 
CREATE TABLE IF NOT EXISTS projection_checkpoints (
  projection_name VARCHAR(255) PRIMARY KEY NOT NULL,
  last_processed_event_id UUID,
  last_processed_event_number_global BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO projection_checkpoints (projection_name, last_processed_event_number_global)
VALUES ('AccountSummaries', 0)
ON CONFLICT DO NOTHING;

INSERT INTO projection_checkpoints (projection_name, last_processed_event_number_global)
VALUES ('TransactionHistory', 0)
ON CONFLICT DO NOTHING;
