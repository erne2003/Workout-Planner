// Soft-deleted rows (tombstones) are kept this long so offline clients can
// learn about the deletion, then purged by purge_sync_tombstones(). A client
// whose sync cursor is older than this must do a full resync.
const TOMBSTONE_RETENTION_DAYS = 90;

module.exports = { TOMBSTONE_RETENTION_DAYS };
