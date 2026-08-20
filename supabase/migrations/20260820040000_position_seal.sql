-- Chaîne de preuve scellée.
--
-- Une position enregistrée ne vaut devant un tribunal que si l'on peut établir
-- qu'elle n'a pas été retouchée après coup. Chaque relevé porte donc l'empreinte
-- du précédent : modifier, supprimer ou intercaler une ligne casse la chaîne à
-- partir de ce point, et la rupture se voit.
--
-- Ce n'est pas de la cryptographie forte — quelqu'un qui maîtrise la base peut
-- recalculer toute la suite. C'est un scellé : il rend la retouche visible et
-- coûteuse, là où aujourd'hui elle serait indétectable. Prolongement direct de
-- l'argument du dossier : les peines alternatives deviennent prouvables.
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS seal_seq  BIGINT,
  ADD COLUMN IF NOT EXISTS seal_prev TEXT,
  ADD COLUMN IF NOT EXISTS seal_hash TEXT;

-- Rang du scellé par bracelet : c'est l'ordre de la chaîne, indépendant de
-- l'horodatage du relevé (le bracelet retransmet parfois des trames différées).
CREATE INDEX IF NOT EXISTS idx_positions_seal ON positions (device_id, seal_seq DESC);

COMMENT ON COLUMN positions.seal_hash IS
  'Empreinte SHA-256 de (device_id, recorded_at, lat, lng, seal_prev) — chaîne de preuve.';
