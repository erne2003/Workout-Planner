/**
 * Platform-adaptive storage abstraction for @apex/core.
 *
 * Two adapters are supported:
 * 1. General storage (settings, UI state, cached preferences) — synchronous,
 *    cache-first reads, fire-and-forget writes. Acceptable for low-stakes data.
 * 2. Secure storage (auth tokens) — async, awaited writes, encrypted at rest
 *    on mobile (via expo-secure-store). Falls back to general storage on web.
 *
 * Both adapters are registered at app boot via registerStorage() and
 * registerSecureStorage() before any provider mounts.
 */

let _storage = null;
let _secureStorage = null;

/**
 * Register the platform-specific general storage backend.
 * Must be called before any provider mounts.
 *
 * @param {Object} adapter - Must implement:
 *   getItem(key) → string | null
 *   setItem(key, val) → void
 *   removeItem(key) → void
 *   clear() → void
 *   length → number (live getter preferred)
 *   key(index) → string | null
 */
export function registerStorage(adapter) {
  _storage = adapter;
}

/**
 * Register a separate adapter for sensitive data (auth tokens).
 * Falls back to the general storage adapter if not registered.
 *
 * @param {Object} adapter - Must implement:
 *   getItemAsync(key) → Promise<string | null>
 *   setItemAsync(key, val) → Promise<void>
 *   removeItemAsync(key) → Promise<void>
 */
export function registerSecureStorage(adapter) {
  _secureStorage = adapter;
}

/**
 * Get the registered general storage adapter.
 * Returns null if not registered (SSR, test environments).
 */
export function getStorage() {
  return _storage;
}

/**
 * Get the registered secure storage adapter.
 * If no secure adapter was registered, wraps the general adapter
 * with async semantics so callers can use a uniform async API.
 * Returns null if neither adapter is registered.
 */
export function getSecureStorage() {
  if (_secureStorage) return _secureStorage;
  if (_storage) {
    return {
      getItemAsync: async (key) => _storage.getItem(key),
      setItemAsync: async (key, val) => _storage.setItem(key, val),
      removeItemAsync: async (key) => _storage.removeItem(key),
    };
  }
  return null;
}
