ALTER TABLE albums
ADD COLUMN route_id TEXT;

UPDATE albums
SET route_id = lower(hex(randomblob(16)))
WHERE route_id IS NULL OR trim(route_id) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_albums_route_id
ON albums(route_id);

CREATE TRIGGER IF NOT EXISTS albums_route_id_required_insert
BEFORE INSERT ON albums
WHEN NEW.route_id IS NULL OR trim(NEW.route_id) = ''
BEGIN
  SELECT RAISE(ABORT, 'albums.route_id is required');
END;

CREATE TRIGGER IF NOT EXISTS albums_route_id_required_update
BEFORE UPDATE OF route_id ON albums
WHEN NEW.route_id IS NULL OR trim(NEW.route_id) = ''
BEGIN
  SELECT RAISE(ABORT, 'albums.route_id is required');
END;
