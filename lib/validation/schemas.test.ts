import { describe, expect, it } from "vitest";
import {
  albumCreateSchema,
  imageDuplicateCheckSchema,
  imageUpdateSchema
} from "@/lib/validation/schemas";

describe("gallery schemas", () => {
  it("trims album input", () => {
    expect(albumCreateSchema.parse({ title: "  旅行  ", description: "  夏天  " })).toEqual({
      title: "旅行",
      description: "夏天",
      isPublic: true
    });
  });

  it("allows administrators to create a private album without a visitor key", () => {
    expect(albumCreateSchema.parse({ title: "私密", isPublic: false })).toMatchObject({
      title: "私密",
      isPublic: false
    });
  });

  it("requires at least one image update field", () => {
    expect(() => imageUpdateSchema.parse({})).toThrow("至少需要更新一个字段");
  });

  it("accepts large duplicate-check batches without image data", () => {
    const files = Array.from({ length: 500 }, (_, index) => ({
      clientId: String(index),
      filename: `image-${index}.jpg`,
      sizeBytes: index + 1,
      contentType: "image/jpeg"
    }));

    expect(imageDuplicateCheckSchema.parse({ files }).files).toHaveLength(500);
  });
});
