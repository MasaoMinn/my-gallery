import type { Album } from "@/lib/db/gallery";
import { sortAlbums } from "@/lib/albums/sort";

function album(
  id: string,
  title: string,
  createdAt: string,
  updatedAt: string,
  totalSizeBytes: number
): Album {
  return {
    id,
    title,
    description: "",
    is_public: true,
    cover_image_id: null,
    created_at: createdAt,
    updated_at: updatedAt,
    image_count: 0,
    total_size_bytes: totalSizeBytes,
    cover_image: null
  };
}

const albums = [
  album("b", "相册10", "2026-01-02", "2026-02-01", 100),
  album("a", "相册2", "2026-01-01", "2026-03-01", 300),
  album("c", "旅行", "2026-01-03", "2026-01-01", 200)
];

describe("sortAlbums", () => {
  it("sorts album names naturally", () => {
    expect(sortAlbums(albums, "title", "asc").map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts creation and update timestamps", () => {
    expect(sortAlbums(albums, "createdAt", "desc").map((item) => item.id)).toEqual(["c", "b", "a"]);
    expect(sortAlbums(albums, "updatedAt", "desc").map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by total image size without mutating the source list", () => {
    const sorted = sortAlbums(albums, "size", "desc");

    expect(sorted.map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(albums.map((item) => item.id)).toEqual(["b", "a", "c"]);
  });
});
