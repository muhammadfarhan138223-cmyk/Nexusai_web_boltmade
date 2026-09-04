/*
# Create ai_provider_keys table (server-side AI provider credentials)

1. Purpose
   Stores API keys for AI providers (Groq, Gemini, OpenRouter) so the
   ai-chat edge function can fetch them at request time using the service
   role key. This is the automated equivalent of edge-function secrets.

2. New Tables
   - `ai_provider_keys`
     - `provider` (text, primary key) — e.g. 'groq', 'gemini', 'openrouter'
     - `api_key`  (text, not null)   — the provider API key
     - `enabled`  (boolean, default true) — toggle a provider off without deleting the key
     - `updated_at` (timestamptz, default now())

3. Security
   - RLS is ENABLED on this table.
   - NO policies are defined for anon or authenticated roles, so only the
     service role (which bypasses RLS) can read or write these keys.
   - The anon-key frontend can never access them.
*/

CREATE TABLE IF NOT EXISTS ai_provider_keys (
  provider text PRIMARY KEY,
  api_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_provider_keys ENABLE ROW LEVEL SECURITY;