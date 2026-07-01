-- createUserAction inserts access_scope (FULL/RESTRICTED for OPERATIONAL agents)
-- but the column never existed → EVERY account creation failed with
-- "column access_scope does not exist" and rolled back. No accounts could be
-- created at any level. Add the column.
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_scope TEXT
  CHECK (access_scope IS NULL OR access_scope IN ('FULL', 'RESTRICTED'));
