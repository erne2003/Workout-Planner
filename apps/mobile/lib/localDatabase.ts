import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import * as Crypto from "expo-crypto";
import { registerDatabase } from "@apex/core";

const DATABASE_NAME = "virtus.db";

/**
 * Register the on-device SQLite database with @apex/core (offline-first data).
 * Web keeps using the REST API. If the database can't be opened, the app
 * falls back to REST too, so this never blocks boot.
 */
export function registerLocalDatabase() {
  if (Platform.OS === "web") return;
  try {
    const db = SQLite.openDatabaseSync(DATABASE_NAME);
    db.execSync("PRAGMA journal_mode = WAL");
    registerDatabase({
      execAsync: (sql: string) => db.execAsync(sql),
      runAsync: (sql: string, params: SQLite.SQLiteBindValue[]) => db.runAsync(sql, params),
      getAllAsync: (sql: string, params: SQLite.SQLiteBindValue[]) => db.getAllAsync(sql, params),
      getFirstAsync: (sql: string, params: SQLite.SQLiteBindValue[]) => db.getFirstAsync(sql, params),
      randomUUID: () => Crypto.randomUUID(),
    });
  } catch (e) {
    console.warn("[localDatabase] Could not open SQLite; using the REST API only", e);
  }
}
