import { IMAGE_UPLOAD_HEADERS, encodeUploadHeader } from "@/lib/images/upload-protocol";

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

type ImageUploadMetadata = {
  title: string;
  description: string;
  width: number | null;
  height: number | null;
};

export function uploadImageFile<T>(
  input: string,
  file: File,
  metadata: ImageUploadMetadata,
  onProgress: (progress: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", input);
    request.responseType = "json";
    request.setRequestHeader("content-type", file.type);
    request.setRequestHeader(IMAGE_UPLOAD_HEADERS.filename, encodeUploadHeader(file.name));
    request.setRequestHeader(IMAGE_UPLOAD_HEADERS.size, String(file.size));
    request.setRequestHeader(IMAGE_UPLOAD_HEADERS.title, encodeUploadHeader(metadata.title));
    request.setRequestHeader(
      IMAGE_UPLOAD_HEADERS.description,
      encodeUploadHeader(metadata.description)
    );
    if (metadata.width && metadata.height) {
      request.setRequestHeader(IMAGE_UPLOAD_HEADERS.width, String(metadata.width));
      request.setRequestHeader(IMAGE_UPLOAD_HEADERS.height, String(metadata.height));
    }

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });

    request.addEventListener("load", () => {
      const payload = request.response as ApiEnvelope<T> | null;
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve(payload?.data as T);
        return;
      }

      reject(
        new ApiError(
          payload?.error?.message ?? `上传失败: ${request.status}`,
          request.status,
          payload?.error?.code ?? "upload_error"
        )
      );
    });

    request.addEventListener("error", () => {
      reject(new ApiError("网络连接异常，图片上传失败", 0, "network_error"));
    });
    request.addEventListener("abort", () => {
      reject(new ApiError("图片上传已取消", 0, "upload_aborted"));
    });

    request.send(file);
  });
}

export function createAdminHeaders(adminToken: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (adminToken.trim()) {
    headers.set("x-admin-token", adminToken.trim());
  }
  return headers;
}
