ALTER TABLE albums
ADD COLUMN album_type TEXT NOT NULL DEFAULT 'album'
CHECK (album_type IN ('album', 'setting'));

CREATE INDEX IF NOT EXISTS idx_albums_type_updated
ON albums(album_type, updated_at DESC, id);

CREATE TABLE IF NOT EXISTS album_fields (
  id TEXT PRIMARY KEY,
  album_id TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_album_fields_album_sort
ON album_fields(album_id, sort_order, id);
