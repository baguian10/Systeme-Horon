-- Journal des consultations.
--
-- Un fichier judiciaire nominatif doit pouvoir dire qui a regardé quel dossier,
-- et quand. C'est une exigence de protection des données, et c'est aussi ce qui
-- protège les agents : une consultation tracée est une consultation défendable.
--
-- Table distincte du journal d'audit : les consultations sont bien plus
-- nombreuses que les actes de gestion et noieraient celui-ci. Elles ont aussi
-- leur propre durée de conservation.
CREATE TABLE IF NOT EXISTS case_access_log (
  id         BIGSERIAL PRIMARY KEY,
  case_id    UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id),
  -- Nom et rôle figés à l'instant de la consultation : le journal doit rester
  -- lisible même après la suppression d'un compte.
  actor_name TEXT,
  actor_role TEXT,
  context    TEXT NOT NULL,   -- DOSSIER | SUIVI | INCIDENT | TRAJET | EXPORT
  ip_address INET,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_case_time ON case_access_log (case_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_user_time ON case_access_log (user_id, viewed_at DESC);

-- Lecture réservée au service role, comme le journal d'audit.
ALTER TABLE case_access_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "access_log_service_only" ON case_access_log;
CREATE POLICY "access_log_service_only" ON case_access_log USING (false);
