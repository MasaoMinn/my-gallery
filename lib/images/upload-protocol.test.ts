import { describe, expect, it } from "vitest";
import { decodeUploadHeader, encodeUploadHeader } from "@/lib/images/upload-protocol";

describe("image upload protocol", () => {
  it("round-trips Unicode metadata through ASCII request headers", () => {
    const value = "云幽岛 图片描述";
    expect(decodeUploadHeader(encodeUploadHeader(value))).toBe(value);
  });

  it("treats malformed encoded headers as empty", () => {
    expect(decodeUploadHeader("%invalid")).toBe("");
  });
});
