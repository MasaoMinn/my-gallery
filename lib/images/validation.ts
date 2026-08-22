import { HttpError } from "@/lib/http/errors";

export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif"
]);

export function getMaxUploadBytes(env: CloudflareEnv): number {
  const configuredMb = Number(env.GALLERY_MAX_UPLOAD_MB ?? "95");
  const mb = Number.isFinite(configuredMb) && configuredMb > 0 ? configuredMb : 95;
  return Math.floor(mb * 1024 * 1024);
}

export function assertUploadableImage(file: File, env: CloudflareEnv): void {
  assertUploadableImageMetadata(
    { contentType: file.type, sizeBytes: file.size },
    env
  );
}

export function assertUploadableImageMetadata(
  image: { contentType: string; sizeBytes: number },
  env: CloudflareEnv
): void {
  if (!ALLOWED_IMAGE_TYPES.has(image.contentType)) {
    throw new HttpError(
      400,
      "仅支持 JPEG、PNG、WebP、AVIF 和 GIF 图片",
      "unsupported_image_type"
    );
  }

  const maxBytes = getMaxUploadBytes(env);
  if (!Number.isSafeInteger(image.sizeBytes) || image.sizeBytes <= 0) {
    throw new HttpError(400, "图片文件不能为空", "empty_file");
  }

  if (image.sizeBytes > maxBytes) {
    throw new HttpError(
      413,
      `图片不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`,
      "file_too_large"
    );
  }
}
