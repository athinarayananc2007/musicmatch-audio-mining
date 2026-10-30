-- =============================================================================
-- MusicMatch — Supabase PostgreSQL Migration
-- =============================================================================
-- Run this SQL in the Supabase Dashboard → SQL Editor → New query
-- This creates all tables needed by the MusicMatch backend.
-- =============================================================================

-- 1. Sessions table — tracks browser analysis sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id  TEXT PRIMARY KEY,
    user_id     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Songs table — stores analyzed song data (features + enriched metadata)
CREATE TABLE IF NOT EXISTS songs (
    id                BIGSERIAL PRIMARY KEY,
    session_id        TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    features          JSONB NOT NULL,
    tempo             DOUBLE PRECISION,
    spectral_centroid DOUBLE PRECISION,
    chroma_mean       DOUBLE PRECISION,
    zcr_mean          DOUBLE PRECISION,
    rms_mean          DOUBLE PRECISION,
    cluster           INTEGER,
    pca_x             DOUBLE PRECISION,
    pca_y             DOUBLE PRECISION,
    original_index    INTEGER,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_songs_session_id ON songs(session_id);

-- 3. Similarity table — stores pairwise cosine similarity matrices (JSON)
CREATE TABLE IF NOT EXISTS similarity (
    session_id  TEXT PRIMARY KEY REFERENCES sessions(session_id) ON DELETE CASCADE,
    matrix      JSONB NOT NULL
);

-- 4. Users table — JWT-authenticated user accounts
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Contact messages table — contact form submissions
CREATE TABLE IF NOT EXISTS contact_messages (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Row Level Security (RLS) Policies
-- =============================================================================
-- Using service_role key in the backend bypasses RLS, so these are optional
-- but recommended for production security.

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE similarity ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow the service_role (backend) full access to all tables.
-- These policies permit all operations when accessed via the service_role key.
CREATE POLICY "Service role full access on sessions"
    ON sessions FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on songs"
    ON songs FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on similarity"
    ON similarity FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on users"
    ON users FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on contact_messages"
    ON contact_messages FOR ALL
    USING (true) WITH CHECK (true);

-- =============================================================================
-- Done! Your Supabase database is ready for MusicMatch.
-- =============================================================================
