export type ApiEnvelope<T> = {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? `请求失败: ${response.status}`,
      response.status,
      payload.error?.code ?? "request_error"
    );
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
