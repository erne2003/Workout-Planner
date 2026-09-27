/**
 * registerDatabase() adapter backed by Node's built-in SQLite, for tests.
 * Not exported from @apex/core: node:sqlite must never reach the app bundle.
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const plain = (row) => (row ? { ...row } : null);

export function createNodeSqliteAdapter(path = ":memory:") {
  const db = new DatabaseSync(path);
  return {
    execAsync: async (sql) => {
      db.exec(sql);
    },
    runAsync: async (sql, params = []) => {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getAllAsync: async (sql, params = []) => db.prepare(sql).all(...params).map(plain),
    getFirstAsync: async (sql, params = []) => plain(db.prepare(sql).get(...params)),
    randomUUID,
    close: () => db.close(),
  };
}
