-- Armement à la pose.
--
-- Le dossier passe en surveillance active dès que la sangle se verrouille sur
-- la cheville (trame d'alarme AP10, état 16). Réglage par bracelet, désactivé
-- par défaut : l'armement automatique doit être un choix explicite.
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS arm_on_wear BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN devices.arm_on_wear IS
  'true = fermer la sangle active la surveillance du dossier en attente (état AP10 16).';
