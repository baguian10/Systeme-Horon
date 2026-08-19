-- Interrupteur de liste blanche (commande IW BP84).
--
-- Les numéros autorisés étaient déjà stockés (call_whitelist), mais rien ne
-- gardait l'état de l'interrupteur : sans lui, le protocole laisse n'importe
-- quel numéro appeler le bracelet, la liste ne servant qu'aux commandes SMS.
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS call_whitelist_only BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN devices.call_whitelist_only IS
  'true = le bracelet n''accepte les appels que des numéros de call_whitelist (IW BP84).';
