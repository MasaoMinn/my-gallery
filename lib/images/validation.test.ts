import { describe, expect, it } from "vitest";
import { assertUploadableImage, getMaxUploadBytes } from "@/lib/images/validation";

const env = {
  GALLERY_MAX_UPLOAD_MB: "1"
} as CloudflareEnv;

describe("image upload validation", () => {
  it("uses configured max upload size", () => {
    expect(getMaxUploadBytes(env)).toBe(1024 * 1024);
  });

  it("accepts supported image files", () => {
    const file = new File([new Uint8Array([1])], "photo.webp", { type: "image/webp" });
    expect(() => assertUploadableImage(file, env)).not.toThrow();
  });

  it("rejects unsupported content types", () => {
    const file = new File([new Uint8Array([1])], "photo.txt", { type: "text/plain" });
    expect(() => assertUploadableImage(file, env)).toThrow("仅支持");
  });

  it("rejects oversized files", () => {
    const bytes = new Uint8Array(1024 * 1024 + 1);
    const file = new File([bytes], "large.jpg", { type: "image/jpeg" });
    expect(() => assertUploadableImage(file, env)).toThrow("不能超过");
  });
});
