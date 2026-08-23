import { describe, expect, it } from "vitest";
import {
  albumCreateSchema,
  albumFieldsUpdateSchema,
  imageDuplicateCheckSchema,
  imageUpdateSchema
} from "@/lib/validation/schemas";

describe("gallery schemas", () => {
  it("trims album input", () => {
    expect(albumCreateSchema.parse({ title: "  旅行  ", description: "  夏天  " })).toEqual({
      title: "旅行",
      description: "夏天",
      albumType: "album",
      isPublic: true
    });
  });

  it("accepts setting collections and trims flexible base fields", () => {
    expect(albumCreateSchema.parse({ title: "角色", albumType: "setting" })).toMatchObject({
      albumType: "setting"
    });
    expect(albumFieldsUpdateSchema.parse({
      fields: [{ label: "  物种  ", value: "  雪豹  " }]
    })).toEqual({ fields: [{ label: "物种", value: "雪豹" }] });
  });

  it("rejects blank setting collection field labels", () => {
    expect(() => albumFieldsUpdateSchema.parse({
      fields: [{ label: "  ", value: "内容" }]
    })).toThrow("字段名称不能为空");
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
