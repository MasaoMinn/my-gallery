import { describe, expect, it } from "vitest";
import { ALBUM_ROUTE_ID_PATTERN, createAlbumRouteId } from "@/lib/albums/route-id";

describe("album route ids", () => {
  it("creates stable URL-safe identifiers with enough entropy", () => {
    const ids = Array.from({ length: 100 }, () => createAlbumRouteId());

    expect(new Set(ids)).toHaveLength(ids.length);
    expect(ids.every((id) => ALBUM_ROUTE_ID_PATTERN.test(id))).toBe(true);
  });
});
