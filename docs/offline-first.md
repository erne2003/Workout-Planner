# Offline-first sync: rollout and test plan

The mobile app now reads and writes a local SQLite database, and a sync engine keeps it in step with the server. The app opens instantly and works fully offline. Changes made offline are pushed when the connection returns.

## How it fits together

| Layer | Where | What it does |
|---|---|---|
| Server schema | `backend/sql/012_offline_sync.sql` | `uuid`, `updated_at` and `deleted_at` on the six synced tables. Triggers stamp `updated_at` and cascade soft deletes. Tombstones are purged after 90 days. |
| Sync API | `backend/routes/sync.routes.js` | `GET /sync/pull` (paged changes since a cursor, tombstones included) and `POST /sync/push` (up to 100 changes, idempotent by uuid). |
| Local database | `packages/core/src/db/` | SQLite schema, repositories (each write adds an outbox entry), `useLiveQuery`. |
| Sync engine | `packages/core/src/sync/` | `SyncManager` (push, then pull; backoff; parking) and the session rules for logout and user switch. |
| App | `DataContext`, the screens, `apps/mobile/lib/localDatabase.ts` | Screens read live SQLite queries and write through context actions (`logWorkout`, `saveRoutine`, `logPR`, …). |

The old REST routes still work, so app builds that are already installed keep working throughout the rollout.

## Automated tests

Both suites need the local Postgres. They drop and recreate `workout_planner_sync_test` on every run, and refuse to run against anything but a `*_test` database on localhost. Set `TEST_DATABASE_URL` if your local credentials differ from `config/db.js`. Don't run the two suites at the same time, because they share the database.

```powershell
cd backend; npm test                          # schema migration + sync API (21 tests)
npm run test:offline --workspace @apex/core   # local DB, sync engine, sessions (43 tests)
```

The core suite runs the real `SyncManager` and SQLite against the real backend. It covers the plan's test matrix wherever it can be simulated:
- 10 workouts logged offline reaching the server once
- a lost push response
- killing the app mid-sync
- a delete made offline
- the same workout edited on two clients
- a hung network
- the 90-day full resync

## Rollout order

1. **Migrate Supabase.** Run `cd backend; node migrate.js`. The migration only adds columns, indexes, triggers and a function, so the backend and app builds already in use are unaffected.
2. **Deploy the backend** from this branch to Railway: soft deletes, `/sync`, and the daily tombstone purge. Deploy it before any new app build ships, because the new app calls `/sync`.
3. **Bump the app version** in `apps/mobile/app.json` (for example 1.1.0 → 1.2.0) before building. This release adds native modules (`expo-sqlite`, `expo-crypto`, NetInfo). With the `appVersion` runtime policy, keeping 1.1.0 would let a later `eas update` reach old binaries that don't have those modules, and they would crash.
4. **Build** a new development build, or a TestFlight build with `eas build --platform ios --profile production`. This can't go out as an over-the-air update. Expo Go already includes all three modules, so it works for quick checks against the local backend.

## On-device checklist

Some checks need the TestFlight or development build rather than Metro. In airplane mode the phone can't reach Metro, and Metro can't cold-start an app.

| Scenario | How | Expected |
|---|---|---|
| First launch after the upgrade | Install over the current version while signed in | A "Setting up your data" banner appears once, then all history shows. Later launches show data immediately. |
| Cold start, backend down | Stop the backend, kill the app, reopen it | Home shows your data straight away. Settings → Sync says "Offline". |
| Cold start in airplane mode | Airplane mode, kill the app, reopen it | Same as above. You stay signed in. |
| Log a workout offline | Airplane mode, finish a workout | It shows everywhere at once, and Settings shows the changes waiting. |
| Reconnect | Turn airplane mode off | It syncs within seconds and Settings says "All changes synced". Supabase has the workout once. |
| Slow network | Settings → Developer → Network Link Conditioner → 3G | The app stays responsive and sync finishes eventually. |
| Kill the app mid-sync | Log several workouts offline, reconnect, and kill the app right away | After reopening, everything arrives with no duplicates. |
| Delete while offline | Airplane mode, delete a routine | It's gone at once, and stays gone after reconnecting. In Supabase the row has `deleted_at` set. |
| Change on another client | Edit on a second device, or through the REST API | It appears after you bring the app to the foreground. |
| Logout with unsynced changes | Airplane mode, log a PR, log out | A warning says how many changes would be lost. Cancel keeps everything. "Log Out Anyway" wipes the device. |
| Different account, same device | Log out, then log in as another account | None of the first account's data appears. |
| Delete account | Settings → Delete Account | You return to the login screen and the device holds no data. |
| Parked changes | Hard to trigger by hand; covered by the automated tests | Settings shows "N changes couldn't sync" with a Retry button. |

## Behaviour to know about

- **Conflicts.** The last push wins, one whole row at a time. A local edit that hasn't been pushed yet always wins on this device until it's pushed. A delete wins over any edit.
- **Times.** A workout's time comes from the device clock and is only used for display. Sync ordering uses server timestamps only, so clock skew doesn't matter.
- **Custom exercises created offline.** They get a temporary id until they sync. The server matches them by name, and their "previous" hints appear after the next sync.
- **Forced sign-out** (the session was revoked). Local data stays on the device. Signing back in as the same user pushes anything unsynced, and signing in as someone else wipes it.
- **Not synced, same as before.** The in-progress workout and "next session" targets live in AsyncStorage.
- **Web admin app.** Unaffected. It doesn't use `@apex/core`, and `DataContext` falls back to the REST API wherever no local database is registered.
