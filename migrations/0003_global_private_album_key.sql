CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO app_settings (key, value, updated_at)
VALUES (
  'private_album_access_key',
  COALESCE((SELECT access_key FROM albums WHERE access_key <> '' LIMIT 1), ''),
  CURRENT_TIMESTAMP
);

UPDATE albums SET access_key = '';
