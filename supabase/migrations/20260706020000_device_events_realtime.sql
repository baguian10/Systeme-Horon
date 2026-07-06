-- Live activity stream: the monitoring console subscribes to device_events via
-- Supabase Realtime, but the table was never added to the realtime publication,
-- so ONLINE/OFFLINE/COMMAND/RESTART/SIM_CHANGE events never reached the stream
-- live (only the initial server-fetched batch showed). The table already has a
-- SELECT policy for authenticated users, so publishing it is all that's needed.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE device_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
