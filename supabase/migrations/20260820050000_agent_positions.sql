-- Mode escorte — position des agents sur le terrain.
--
-- Quand un agent part vérifier, le centre le suit au téléphone : « tu en es
-- où ? ». La carte montre desormais les deux points, celui de l'agent et celui
-- de la personne, et la distance qui les sépare.
--
-- Une seule ligne par agent, remplacée à chaque relevé : c'est une position
-- courante, pas un historique. Suivre un agent dans la durée serait une
-- surveillance de salarié, ce qui n'est ni le sujet ni acceptable.
CREATE TABLE IF NOT EXISTS agent_positions (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  accuracy_m  REAL,
  case_id     UUID REFERENCES cases(id) ON DELETE SET NULL,  -- mission en cours
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_positions_time ON agent_positions (recorded_at DESC);

ALTER TABLE agent_positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agent_positions_service_only" ON agent_positions;
CREATE POLICY "agent_positions_service_only" ON agent_positions USING (false);
