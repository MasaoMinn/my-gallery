export type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `请求失败: ${response.status}`);
  }

  return payload.data as T;
}

export function createAdminHeaders(adminToken: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (adminToken.trim()) {
    headers.set("x-admin-token", adminToken.trim());
  }
  return headers;
}

export function createAlbumAccessHeaders(accessKey: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (accessKey.trim()) {
    headers.set("x-album-access-key", accessKey.trim());
  }
  return headers;
}

export function appendAlbumAccessKey(path: string, accessKey: string): string {
  if (!accessKey.trim()) {
    return path;
  }

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}accessKey=${encodeURIComponent(accessKey.trim())}`;
}
