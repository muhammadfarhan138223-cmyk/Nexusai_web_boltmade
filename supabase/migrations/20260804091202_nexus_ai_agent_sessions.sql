-- Create agent_sessions table for the Agent Hub.
-- Each row is one expert-agent conversation with plan, status, and step tracking.
-- Owner-scoped via auth.uid(), TO authenticated.

CREATE TABLE IF NOT EXISTS agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_type text NOT NULL,
  title text NOT NULL DEFAULT 'New agent session',
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','awaiting_approval','building','paused','completed','failed')),
  plan jsonb,
  current_step integer NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT 'groq/llama-3.3-70b-versatile',
  provider text NOT NULL DEFAULT 'groq',
  chat_id uuid REFERENCES chats(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_agent_sessions" ON agent_sessions;
CREATE POLICY "select_own_agent_sessions" ON agent_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_agent_sessions" ON agent_sessions;
CREATE POLICY "insert_own_agent_sessions" ON agent_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_agent_sessions" ON agent_sessions;
CREATE POLICY "update_own_agent_sessions" ON agent_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_agent_sessions" ON agent_sessions;
CREATE POLICY "delete_own_agent_sessions" ON agent_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id ON agent_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at ON agent_sessions(updated_at DESC);

DROP TRIGGER IF EXISTS trg_agent_sessions_updated_at ON agent_sessions;
CREATE TRIGGER trg_agent_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
