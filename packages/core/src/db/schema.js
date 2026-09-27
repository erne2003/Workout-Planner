/**
 * Local SQLite schema, upgraded with PRAGMA user_version: MIGRATIONS[n] takes
 * the database from version n to n + 1. Never edit a shipped migration —
 * append a new one.
 *
 * The synced tables mirror the server's, keyed by uuid (no integer ids on the
 * client; server_id is kept only for display compatibility). Children point at
 * their parent's uuid. There are no foreign keys: pulled pages may deliver a
 * child before its parent.
 */

export const SYNCED_TABLES = [
  "workouts",
  "workout_sets",
  "routines",
  "routine_exercises",
  "prs",
  "body_metrics",
];

export const MIGRATIONS = [
  // v1 — initial offline-first schema
  `
  CREATE TABLE workouts (
    uuid        TEXT PRIMARY KEY NOT NULL,
    server_id   INTEGER,
    name        TEXT NOT NULL,
    notes       TEXT,
    status      TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT
  );
  CREATE INDEX workouts_created_at_idx ON workouts (created_at);

  CREATE TABLE workout_sets (
    uuid          TEXT PRIMARY KEY NOT NULL,
    server_id     INTEGER,
    workout_uuid  TEXT NOT NULL,
    exercise_id   INTEGER,
    exercise_name TEXT NOT NULL,
    muscle_group  TEXT,
    set_order     INTEGER NOT NULL,
    reps          INTEGER NOT NULL,
    weight        REAL NOT NULL,
    rir           REAL,
    updated_at    TEXT
  );
  CREATE INDEX workout_sets_workout_idx ON workout_sets (workout_uuid);
  CREATE INDEX workout_sets_exercise_idx ON workout_sets (exercise_id);

  CREATE TABLE routines (
    uuid        TEXT PRIMARY KEY NOT NULL,
    server_id   INTEGER,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT
  );

  CREATE TABLE routine_exercises (
    uuid           TEXT PRIMARY KEY NOT NULL,
    server_id      INTEGER,
    routine_uuid   TEXT NOT NULL,
    exercise_id    INTEGER,
    exercise_name  TEXT NOT NULL,
    muscle_group   TEXT,
    exercise_order INTEGER NOT NULL,
    sets           INTEGER NOT NULL DEFAULT 3,
    reps           INTEGER NOT NULL DEFAULT 10,
    weight         REAL NOT NULL DEFAULT 0,
    rir            REAL DEFAULT 0,
    updated_at     TEXT
  );
  CREATE INDEX routine_exercises_routine_idx ON routine_exercises (routine_uuid);

  CREATE TABLE prs (
    uuid          TEXT PRIMARY KEY NOT NULL,
    server_id     INTEGER,
    exercise_id   INTEGER,
    exercise_name TEXT NOT NULL,
    muscle_group  TEXT,
    weight        REAL NOT NULL,
    achieved_at   TEXT NOT NULL,
    updated_at    TEXT
  );

  CREATE TABLE body_metrics (
    uuid           TEXT PRIMARY KEY NOT NULL,
    server_id      INTEGER,
    training_years REAL,
    weight         REAL NOT NULL,
    height         TEXT,
    body_fat       REAL,
    gender         TEXT,
    logged_at      TEXT NOT NULL,
    updated_at     TEXT
  );

  -- Shared exercise catalogue, cached for offline search
  CREATE TABLE exercises (
    id           INTEGER PRIMARY KEY NOT NULL,
    name         TEXT NOT NULL,
    muscle_group TEXT
  );
  CREATE INDEX exercises_name_idx ON exercises (name COLLATE NOCASE);

  -- Local writes waiting to be pushed, in order
  CREATE TABLE outbox (
    seq         INTEGER PRIMARY KEY AUTOINCREMENT,
    tbl         TEXT NOT NULL,
    op          TEXT NOT NULL,
    uuid        TEXT NOT NULL,
    parent_uuid TEXT,
    payload     TEXT,
    attempts    INTEGER NOT NULL DEFAULT 0,
    last_error  TEXT,
    created_at  TEXT NOT NULL
  );
  CREATE INDEX outbox_uuid_idx ON outbox (uuid);

  -- Sync cursor, last sync time, signed-in user id
  CREATE TABLE sync_state (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
  `,
];
