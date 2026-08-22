import type { Album } from "@/lib/db/gallery";
import {
  ADMIN_SESSION_COOKIE,
  readCookie,
  verifyAdminSession,
  verifyAdminToken
} from "@/lib/auth/admin-session";
import { HttpError } from "@/lib/http/errors";

export function configuredAdminToken(env: CloudflareEnv): string {
  const token = env.GALLERY_ADMIN_TOKEN?.trim() ?? "";
  if (!token) {
    throw new HttpError(
      503,
      "管理员密钥尚未配置，写操作已关闭",
      "admin_token_not_configured"
    );
  }
  return token;
}

export async function requireAdmin(request: Request, env: CloudflareEnv): Promise<void> {
  const configuredToken = configuredAdminToken(env);
  const directToken = readDirectToken(request);

  if (directToken && (await verifyAdminToken(directToken, configuredToken))) {
    return;
  }

  const session = readCookie(request, ADMIN_SESSION_COOKIE);
  if (session && (await verifyAdminSession(session, configuredToken))) {
    requireRequestOrigin(request);
    return;
  }

  throw new HttpError(401, "管理员会话无效或已过期", "unauthorized");
}

export async function isAdminRequest(request: Request, env: CloudflareEnv): Promise<boolean> {
  const configuredToken = env.GALLERY_ADMIN_TOKEN?.trim() ?? "";
  if (!configuredToken) {
    return false;
  }

  const directToken = readDirectToken(request);
  if (directToken && (await verifyAdminToken(directToken, configuredToken))) {
    return true;
  }

  const session = readCookie(request, ADMIN_SESSION_COOKIE);
  return Boolean(session && (await verifyAdminSession(session, configuredToken)));
}

export async function requireAlbumReadAccess(
  request: Request,
  env: CloudflareEnv,
  album: Album
): Promise<void> {
  if (album.is_public || (await isAdminRequest(request, env))) {
    return;
  }

  throw new HttpError(404, "相册不存在", "album_not_found");
}

function readDirectToken(request: Request): string {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return request.headers.get("x-admin-token")?.trim() ?? "";
}

export function requireRequestOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new HttpError(403, "请求来源无效", "invalid_origin");
  }

  const requestUrl = new URL(request.url);
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    throw new HttpError(403, "请求来源无效", "invalid_origin");
  }
  const exactOrigin = originUrl.origin === requestUrl.origin;
  const localLoopbackOrigin =
    isLoopbackHost(originUrl.hostname) &&
    isLoopbackHost(requestUrl.hostname) &&
    originUrl.protocol === requestUrl.protocol &&
    originUrl.port === requestUrl.port;

  if (!exactOrigin && !localLoopbackOrigin) {
    throw new HttpError(403, "请求来源无效", "invalid_origin");
  }
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
