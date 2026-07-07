-- Operations-center presence: one row per operator holding an open SSE stream.
-- Heartbeat-refreshed by /api/realtime/stream; rows expire by TTL (last_seen_at)
-- rather than explicit delete, so multiple tabs / dirty disconnects stay correct.
CREATE TABLE IF NOT EXISTS op_presence (
  user_id      uuid PRIMARY KEY,
  full_name    text NOT NULL,
  role         text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE op_presence ENABLE ROW LEVEL SECURITY;
-- Service-role access only (no policies) — read/write goes through the API.
