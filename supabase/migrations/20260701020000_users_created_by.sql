-- Track who provisioned each account. Required by createUserAction (which
-- already inserts created_by) and by the judge's "my agents" scoping — the
-- column was missing, so account creation failed in production and the judge
-- filter matched nothing.
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS users_created_by_idx ON users(created_by);
