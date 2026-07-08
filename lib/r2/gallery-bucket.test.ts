import { describe, expect, it } from "vitest";
import { createImageObjectKey } from "@/lib/r2/gallery-bucket";

describe("createImageObjectKey", () => {
  it("creates stable non-filename object paths", () => {
    expect(createImageObjectKey("album-1", "image-1", "summer trip.jpg", "image/webp")).toBe(
      "albums/album-1/images/image-1/original.webp"
    );
  });

  it("falls back to safe filename extension", () => {
    expect(createImageObjectKey("album-1", "image-1", "scan.tiff", "image/unknown")).toBe(
      "albums/album-1/images/image-1/original.tiff"
    );
  });
});
