export const IMAGE_UPLOAD_HEADERS = {
  filename: "x-gallery-filename",
  size: "x-gallery-size",
  title: "x-gallery-title",
  description: "x-gallery-description",
  width: "x-gallery-width",
  height: "x-gallery-height"
} as const;

export function encodeUploadHeader(value: string): string {
  return encodeURIComponent(value);
}

export function decodeUploadHeader(value: string | null): string {
  if (!value) {
    return "";
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
