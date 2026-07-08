import { describe, expect, it } from "vitest";
import {
  albumCreateSchema,
  imageUpdateSchema,
  privateAlbumAccessKeyUpdateSchema
} from "@/lib/validation/schemas";

describe("gallery schemas", () => {
  it("trims album input", () => {
    expect(albumCreateSchema.parse({ title: "  旅行  ", description: "  夏天  " })).toEqual({
      title: "旅行",
      description: "夏天",
      isPublic: true
    });
  });

  it("requires a global private album access key value", () => {
    expect(() => privateAlbumAccessKeyUpdateSchema.parse({ accessKey: " " })).toThrow(
      "非公开相册密钥不能为空"
    );
  });

  it("requires at least one image update field", () => {
    expect(() => imageUpdateSchema.parse({})).toThrow("至少需要更新一个字段");
  });
});
