-- Retrait autorisé.
--
-- Ouvrir la sangle lève une alerte de sabotage — c'est juste pour un arrachage,
-- faux pour une fin de mesure, une maintenance ou des soins. Un responsable
-- ouvre donc une fenêtre de retrait, motivée et bornée dans le temps : pendant
-- cette fenêtre l'ouverture est enregistrée sans alerte, au-delà elle
-- redevient un sabotage. La fenêtre porte sa propre péremption, personne n'a
-- besoin de penser à la refermer.
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS removal_allowed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removal_reason        TEXT,
  ADD COLUMN IF NOT EXISTS removal_by            UUID REFERENCES users(id);

COMMENT ON COLUMN devices.removal_allowed_until IS
  'Fin de la fenêtre pendant laquelle ouvrir la sangle ne lève pas TAMPER_DETECTED.';
