import { describe, expect, it } from "vitest";
import {
  albumCreateSchema,
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
});
