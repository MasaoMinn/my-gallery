import { HttpError } from "@/lib/http/responses";
import type { Album } from "@/lib/db/gallery";

export function readRequestToken(request: Request): string {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  const headerToken = request.headers.get("x-admin-token");
  if (headerToken) {
    return headerToken.trim();
  }

  const cookie = request.headers.get("cookie");
  const cookieToken = cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("gallery_admin_token="))
    ?.slice("gallery_admin_token=".length);

  return cookieToken ? decodeURIComponent(cookieToken) : "";
}

export function requireAdmin(request: Request, env: CloudflareEnv): void {
  const configuredToken = env.GALLERY_ADMIN_TOKEN?.trim();

  if (!configuredToken) {
    return;
  }

  if (readRequestToken(request) !== configuredToken) {
    throw new HttpError(401, "管理员令牌无效或缺失", "unauthorized");
  }
}

export function isAdminRequest(request: Request, env: CloudflareEnv): boolean {
  const configuredToken = env.GALLERY_ADMIN_TOKEN?.trim();
  if (!configuredToken) {
    return false;
  }

  return readRequestToken(request) === configuredToken;
}

export function readAlbumAccessKey(request: Request): string {
  const url = new URL(request.url);
  return (
    request.headers.get("x-album-access-key")?.trim() ??
    url.searchParams.get("accessKey")?.trim() ??
    ""
  );
}

export function requireAlbumReadAccess(request: Request, env: CloudflareEnv, album: Album): void {
  if (album.is_public || isAdminRequest(request, env)) {
    return;
  }

  if (!album.has_access_key) {
    throw new HttpError(403, "这个相册未配置访问密钥，请联系管理员", "album_access_key_missing");
  }

  throw new HttpError(401, "请输入相册访问密钥", "album_access_required");
}

export function assertAlbumAccessKey(
  request: Request,
  env: CloudflareEnv,
  album: Album,
  storedAccessKey: string
): void {
  if (album.is_public || isAdminRequest(request, env)) {
    return;
  }

  if (readAlbumAccessKey(request) !== storedAccessKey) {
    throw new HttpError(401, "相册访问密钥无效或缺失", "album_access_required");
  }
}
