import { describe, expect, it } from "vitest";
import { createImageObjectKey, putImageObject } from "@/lib/r2/gallery-bucket";

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

describe("putImageObject", () => {
  it("uses a known-length ArrayBuffer when FixedLengthStream is unavailable", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      }
    });
    const stored = { size: 3 } as R2Object;
    let receivedBody: unknown;
    let receivedOptions: R2PutOptions | undefined;
    const bucket = {
      async put(_key: string, value: unknown, options?: R2PutOptions) {
        receivedBody = value;
        receivedOptions = options;
        return stored;
      }
    } as unknown as R2Bucket;

    const object = await putImageObject(bucket, "image-key", body, {
      albumId: "album-1",
      imageId: "image-1",
      filename: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 3
    });

    expect(object).toBe(stored);
    expect(receivedBody).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(receivedBody as ArrayBuffer))).toEqual([1, 2, 3]);
    expect(receivedOptions).toMatchObject({
      httpMetadata: {
        contentType: "image/jpeg",
        cacheControl: "public,max-age=31536000,immutable"
      },
      customMetadata: {
        albumId: "album-1",
        imageId: "image-1",
        originalFilename: "photo.jpg"
      }
    });
  });

  it("rejects a local stream whose declared size is incorrect", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.close();
      }
    });
    const bucket = { put: async () => ({ size: 3 }) } as unknown as R2Bucket;

    await expect(putImageObject(bucket, "image-key", body, {
      albumId: "album-1",
      imageId: "image-1",
      filename: "photo.jpg",
      contentType: "image/jpeg",
      sizeBytes: 4
    })).rejects.toThrow("Image stream length does not match the declared size");
  });
});
