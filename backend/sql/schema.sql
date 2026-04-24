CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id INTEGER PRIMARY KEY,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  embedding vector(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_feedback (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  reply TEXT,
  topic TEXT,
  rating INTEGER,
  helpful BOOLEAN,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_questions (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  reply TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'general',
  confidence NUMERIC,
  mode TEXT NOT NULL DEFAULT 'qa',
  source TEXT,
  match_question TEXT,
  match_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  corrected_answer TEXT,
  corrected_by TEXT,
  corrected_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  message TEXT,
  topic TEXT,
  source TEXT,
  confidence NUMERIC,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
