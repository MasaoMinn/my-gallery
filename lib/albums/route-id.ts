export const ALBUM_ROUTE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const RESERVED_ALBUM_ROUTE_IDS = new Set([
  "admin",
  "album-upload",
  "albums",
  "api",
  "upload"
]);

export function createAlbumRouteId(): string {
  return crypto.randomUUID().replaceAll("-", "").toLowerCase();
}
