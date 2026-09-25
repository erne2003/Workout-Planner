/**
 * Platform-adaptive local database for @apex/core, registered at app boot the
 * same way as registerStorage().
 *
 * Mobile registers expo-sqlite; web registers nothing and keeps reading the
 * REST API (hasDatabase() is false there).
 *
 * The adapter mirrors expo-sqlite's async API:
 *   execAsync(sql) → Promise<void>                       (no params, may hold several statements)
 *   runAsync(sql, params[]) → Promise<{ changes, lastInsertRowId }>
 *   getAllAsync(sql, params[]) → Promise<row[]>
 *   getFirstAsync(sql, params[]) → Promise<row | null>
 *   randomUUID?() → string                               (optional; falls back to crypto.randomUUID)
 *
 * expo-sqlite shares one connection between every caller, so a transaction
 * could interleave with unrelated queries. All access therefore goes through
 * a single queue here: statements and transactions run one at a time.
 */
import { MIGRATIONS } from "./schema.js";
import { emitChange } from "./events.js";

let _adapter = null;
let _ready = null; // Promise<LocalDatabase> once migrations have run

/** Register the platform's SQLite adapter. Must run before any provider mounts. */
export function registerDatabase(adapter) {
  _adapter = adapter;
  _ready = null;
}

/** True when a local database is registered (mobile). */
export function hasDatabase() {
  return !!_adapter;
}

/**
 * The migrated local database. Resolves once, then reuses the same instance.
 * Rejects if no adapter is registered.
 */
export function getDatabase() {
  if (!_adapter) return Promise.reject(new Error("No local database registered"));
  if (!_ready) {
    const db = new LocalDatabase(_adapter);
    _ready = db._migrate().then(() => db);
    _ready.catch(() => { _ready = null; }); // a failed open can be retried
  }
  return _ready;
}

/** A v4 UUID from the adapter, the platform crypto, or Math.random as a last resort. */
export function newUuid() {
  if (_adapter?.randomUUID) return _adapter.randomUUID();
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// SQLite bindings accept null, numbers, strings and blobs only
const bindable = (params = []) =>
  params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));

function connection(adapter) {
  return {
    exec: (sql) => adapter.execAsync(sql),
    run: (sql, params) => adapter.runAsync(sql, bindable(params)),
    all: (sql, params) => adapter.getAllAsync(sql, bindable(params)),
    first: (sql, params) => adapter.getFirstAsync(sql, bindable(params)),
  };
}

class LocalDatabase {
  constructor(adapter) {
    this._adapter = adapter;
    this._conn = connection(adapter);
    this._tail = Promise.resolve();
  }

  // Run task after everything queued before it; a failure never blocks the queue
  _schedule(task) {
    const result = this._tail.then(task);
    this._tail = result.catch(() => {});
    return result;
  }

  async _migrate() {
    const row = await this._conn.first("PRAGMA user_version");
    const current = Number(row?.user_version ?? 0);
    for (let version = current; version < MIGRATIONS.length; version++) {
      await this._conn.exec("BEGIN");
      try {
        await this._conn.exec(MIGRATIONS[version]);
        await this._conn.exec(`PRAGMA user_version = ${version + 1}`);
        await this._conn.exec("COMMIT");
      } catch (e) {
        await this._conn.exec("ROLLBACK").catch(() => {});
        throw e;
      }
    }
  }

  all(sql, params) {
    return this._schedule(() => this._conn.all(sql, params));
  }

  first(sql, params) {
    return this._schedule(() => this._conn.first(sql, params));
  }

  /** Several reads with nothing interleaved between them. */
  read(fn) {
    return this._schedule(() => fn(this._conn));
  }

  /**
   * Run fn(tx) in one transaction. fn marks what it wrote with tx.touch(table);
   * after COMMIT those tables are announced to change listeners with `source`.
   * Inside fn, use only tx — the queue is busy with this transaction.
   */
  async transaction(fn, { source = "local" } = {}) {
    const touched = new Set();
    const result = await this._schedule(async () => {
      const tx = { ...this._conn, touch: (...tables) => tables.forEach((t) => touched.add(t)) };
      await this._conn.exec("BEGIN");
      try {
        const value = await fn(tx);
        await this._conn.exec("COMMIT");
        return value;
      } catch (e) {
        await this._conn.exec("ROLLBACK").catch(() => {});
        touched.clear();
        throw e;
      }
    });
    emitChange(touched, source);
    return result;
  }
}
