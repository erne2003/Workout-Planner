-- Offline-first sync: stable client ids, change tracking and soft deletes for
-- every table the mobile app syncs. Idempotent — safe to run more than once.
--
-- Parents:  workouts, routines, prs, body_metrics  (scoped by user_id)
-- Children: workout_sets → workouts, routine_exercises → routines
--
-- updated_at is stamped by the server only (triggers below), so sync never
-- depends on client clocks. deleted_at marks a tombstone; tombstones are
-- purged after 90 days by purge_sync_tombstones().

-- ── Columns + indexes ─────────────────────────────────────────────────────────
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['workouts', 'workout_sets', 'routines', 'routine_exercises', 'prs', 'body_metrics']
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS uuid uuid NOT NULL DEFAULT gen_random_uuid()', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS deleted_at timestamptz', t);
        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (uuid)', t || '_uuid_key', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (deleted_at) WHERE deleted_at IS NOT NULL', t || '_deleted_at_idx', t);
    END LOOP;
END $$;

-- Pull scans parents by (user_id, updated_at) and children by updated_at
CREATE INDEX IF NOT EXISTS workouts_user_updated_idx     ON workouts (user_id, updated_at);
CREATE INDEX IF NOT EXISTS routines_user_updated_idx     ON routines (user_id, updated_at);
CREATE INDEX IF NOT EXISTS prs_user_updated_idx          ON prs (user_id, updated_at);
CREATE INDEX IF NOT EXISTS body_metrics_user_updated_idx ON body_metrics (user_id, updated_at);
CREATE INDEX IF NOT EXISTS workout_sets_updated_idx      ON workout_sets (updated_at);
CREATE INDEX IF NOT EXISTS routine_exercises_updated_idx ON routine_exercises (updated_at);
CREATE INDEX IF NOT EXISTS workout_sets_workout_id_idx   ON workout_sets (workout_id);
CREATE INDEX IF NOT EXISTS routine_exercises_routine_id_idx ON routine_exercises (routine_id);

-- ── updated_at on every UPDATE ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION sync_set_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['workouts', 'workout_sets', 'routines', 'routine_exercises', 'prs', 'body_metrics']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_set_updated_at', t);
        EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION sync_set_updated_at()', t || '_set_updated_at', t);
    END LOOP;
END $$;

-- ── Children keep their parent's updated_at fresh ────────────────────────────
-- A change to a set or routine exercise also bumps the live parent, so the
-- parent is never older than its newest child.
CREATE OR REPLACE FUNCTION sync_touch_workout() RETURNS trigger AS $$
BEGIN
    UPDATE workouts SET updated_at = now()
     WHERE id = COALESCE(NEW.workout_id, OLD.workout_id)
       AND deleted_at IS NULL
       AND updated_at < now();
    IF TG_OP = 'UPDATE' AND OLD.workout_id IS DISTINCT FROM NEW.workout_id THEN
        UPDATE workouts SET updated_at = now()
         WHERE id = OLD.workout_id AND deleted_at IS NULL AND updated_at < now();
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_touch_routine() RETURNS trigger AS $$
BEGIN
    UPDATE routines SET updated_at = now()
     WHERE id = COALESCE(NEW.routine_id, OLD.routine_id)
       AND deleted_at IS NULL
       AND updated_at < now();
    IF TG_OP = 'UPDATE' AND OLD.routine_id IS DISTINCT FROM NEW.routine_id THEN
        UPDATE routines SET updated_at = now()
         WHERE id = OLD.routine_id AND deleted_at IS NULL AND updated_at < now();
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workout_sets_touch_parent ON workout_sets;
CREATE TRIGGER workout_sets_touch_parent
    AFTER INSERT OR UPDATE OR DELETE ON workout_sets
    FOR EACH ROW EXECUTE FUNCTION sync_touch_workout();

DROP TRIGGER IF EXISTS routine_exercises_touch_parent ON routine_exercises;
CREATE TRIGGER routine_exercises_touch_parent
    AFTER INSERT OR UPDATE OR DELETE ON routine_exercises
    FOR EACH ROW EXECUTE FUNCTION sync_touch_routine();

-- ── Soft-deleting a parent tombstones its children ───────────────────────────
CREATE OR REPLACE FUNCTION sync_cascade_workout_delete() RETURNS trigger AS $$
BEGIN
    UPDATE workout_sets SET deleted_at = NEW.deleted_at
     WHERE workout_id = NEW.id AND deleted_at IS NULL;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_cascade_routine_delete() RETURNS trigger AS $$
BEGIN
    UPDATE routine_exercises SET deleted_at = NEW.deleted_at
     WHERE routine_id = NEW.id AND deleted_at IS NULL;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS workouts_cascade_soft_delete ON workouts;
CREATE TRIGGER workouts_cascade_soft_delete
    AFTER UPDATE OF deleted_at ON workouts
    FOR EACH ROW
    WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    EXECUTE FUNCTION sync_cascade_workout_delete();

DROP TRIGGER IF EXISTS routines_cascade_soft_delete ON routines;
CREATE TRIGGER routines_cascade_soft_delete
    AFTER UPDATE OF deleted_at ON routines
    FOR EACH ROW
    WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    EXECUTE FUNCTION sync_cascade_routine_delete();

-- ── Tombstone purge ──────────────────────────────────────────────────────────
-- Clients whose sync cursor is older than the retention window are told to
-- do a full resync (see GET /sync/pull), so purged tombstones are never missed.
-- The backend calls this once a day. With pg_cron enabled you can schedule it
-- in the database instead:
--   SELECT cron.schedule('purge-sync-tombstones', '17 3 * * *',
--                        $$SELECT purge_sync_tombstones(90)$$);
CREATE OR REPLACE FUNCTION purge_sync_tombstones(retention_days INT DEFAULT 90) RETURNS INT AS $$
DECLARE
    cutoff  timestamptz := now() - make_interval(days => retention_days);
    n       INT;
    total   INT := 0;
BEGIN
    DELETE FROM workout_sets      WHERE deleted_at < cutoff; GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    DELETE FROM routine_exercises WHERE deleted_at < cutoff; GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    -- Parents only once no live child still points at them
    DELETE FROM workouts w WHERE w.deleted_at < cutoff
       AND NOT EXISTS (SELECT 1 FROM workout_sets ws WHERE ws.workout_id = w.id);
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    DELETE FROM routines r WHERE r.deleted_at < cutoff
       AND NOT EXISTS (SELECT 1 FROM routine_exercises re WHERE re.routine_id = r.id);
    GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    DELETE FROM prs          WHERE deleted_at < cutoff; GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    DELETE FROM body_metrics WHERE deleted_at < cutoff; GET DIAGNOSTICS n = ROW_COUNT; total := total + n;
    RETURN total;
END;
$$ LANGUAGE plpgsql;
