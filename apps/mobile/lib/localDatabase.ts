/**
 * Web: no local database, so the app keeps using the REST API. iOS and Android
 * load localDatabase.native.ts, which keeps expo-sqlite (and its wasm build)
 * out of the web bundle.
 */
export function registerLocalDatabase() {}
