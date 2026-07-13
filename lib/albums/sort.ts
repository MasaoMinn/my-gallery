import type { Album } from "@/lib/db/gallery";

export type AlbumSortField = "title" | "createdAt" | "updatedAt" | "size";
export type SortDirection = "asc" | "desc";

const titleCollator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base"
});

export function sortAlbums(
  albums: Album[],
  field: AlbumSortField,
  direction: SortDirection
): Album[] {
  const directionMultiplier = direction === "asc" ? 1 : -1;

  return albums.slice().sort((left, right) => {
    let comparison: number;

    switch (field) {
      case "title":
        comparison = titleCollator.compare(left.title, right.title);
        break;
      case "createdAt":
        comparison = left.created_at.localeCompare(right.created_at);
        break;
      case "size":
        comparison = left.total_size_bytes - right.total_size_bytes;
        break;
      case "updatedAt":
        comparison = left.updated_at.localeCompare(right.updated_at);
        break;
    }

    return comparison === 0
      ? left.id.localeCompare(right.id)
      : comparison * directionMultiplier;
  });
}
