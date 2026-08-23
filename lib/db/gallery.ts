export type AlbumType = "album" | "setting";

export type Album = {
  id: string;
  title: string;
  description: string;
  album_type: AlbumType;
  is_public: boolean;
  cover_image_id: string | null;
  created_at: string;
  updated_at: string;
  image_count: number;
  total_size_bytes: number;
  cover_image: ImageSummary | null;
};

export type AlbumField = {
  id: string;
  album_id: string;
  label: string;
  value: string;
  sort_order: number;
};

export type ImageSummary = {
  id: string;
  album_id: string;
  content_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  description: string;
  created_at: string;
  updated_at: string;
};

export type GalleryImage = ImageSummary;

export type StoredImage = ImageSummary & {
  r2_key: string;
  filename: string;
  title: string;
  sort_order: number;
};

type AlbumListRow = {
  id: string;
  title: string;
  description: string;
  album_type: string | null;
  is_public: number | string | null;
  access_key: string | null;
  cover_image_id: string | null;
  created_at: string;
  updated_at: string;
  image_count: number | string | null;
  total_size_bytes: number | string | null;
  cover_id: string | null;
  cover_album_id: string | null;
  cover_r2_key: string | null;
  cover_filename: string | null;
  cover_content_type: string | null;
  cover_size_bytes: number | string | null;
  cover_width: number | string | null;
  cover_height: number | string | null;
  cover_title: string | null;
  cover_description: string | null;
  cover_sort_order: number | string | null;
  cover_created_at: string | null;
  cover_updated_at: string | null;
};

export async function listAlbums(db: D1Database, includePrivate = false): Promise<Album[]> {
  const result = await db
    .prepare(
      `
      SELECT
        a.*,
        COALESCE(stats.image_count, 0) AS image_count,
        COALESCE(stats.total_size_bytes, 0) AS total_size_bytes,
        cover.id AS cover_id,
        cover.album_id AS cover_album_id,
        cover.r2_key AS cover_r2_key,
        cover.filename AS cover_filename,
        cover.content_type AS cover_content_type,
        cover.size_bytes AS cover_size_bytes,
        cover.width AS cover_width,
        cover.height AS cover_height,
        cover.title AS cover_title,
        cover.description AS cover_description,
        cover.sort_order AS cover_sort_order,
        cover.created_at AS cover_created_at,
        cover.updated_at AS cover_updated_at
      FROM albums a
      LEFT JOIN (
        SELECT album_id, COUNT(*) AS image_count, COALESCE(SUM(size_bytes), 0) AS total_size_bytes
        FROM images
        GROUP BY album_id
      ) stats ON stats.album_id = a.id
      LEFT JOIN images cover ON cover.id = a.cover_image_id
      WHERE (? = 1 OR a.is_public = 1)
      ORDER BY a.updated_at DESC, a.created_at DESC, a.id ASC
      `
    )
    .bind(includePrivate ? 1 : 0)
    .all<AlbumListRow>();

  return (result.results ?? []).map(toAlbum);
}

export async function createAlbum(
  db: D1Database,
  input: {
    id: string;
    title: string;
    description: string;
    albumType: AlbumType;
    isPublic: boolean;
    now: string;
  }
): Promise<Album> {
  const statements = [
    db.prepare(
      `
      INSERT INTO albums (
        id, title, description, album_type, is_public, access_key, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      input.id,
      input.title,
      input.description,
      input.albumType,
      input.isPublic ? 1 : 0,
      "",
      input.now,
      input.now
    )
  ];

  if (input.albumType === "setting") {
    const defaultFields = [
      ["名字", input.title],
      ["物种", ""],
      ["性别", ""],
      ["性格", ""]
    ];
    statements.push(
      ...defaultFields.map(([label, value], index) =>
        db.prepare(
          `
          INSERT INTO album_fields (
            id, album_id, label, value, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `
        ).bind(
          crypto.randomUUID(),
          input.id,
          label,
          value,
          index,
          input.now,
          input.now
        )
      )
    );
  }

  await db.batch(statements);

  const album = await getAlbum(db, input.id);
  if (!album) {
    throw new Error("Created album could not be read back");
  }

  return album;
}

export async function listAlbumFields(
  db: D1Database,
  albumId: string
): Promise<AlbumField[]> {
  const result = await db
    .prepare(
      `
      SELECT id, album_id, label, value, sort_order
      FROM album_fields
      WHERE album_id = ?
      ORDER BY sort_order ASC, id ASC
      `
    )
    .bind(albumId)
    .all<AlbumField>();

  return (result.results ?? []).map((field) => ({
    ...field,
    sort_order: toNumber(field.sort_order)
  }));
}

export async function replaceAlbumFields(
  db: D1Database,
  albumId: string,
  fields: Array<{ label: string; value: string }>,
  now: string
): Promise<AlbumField[]> {
  const statements = [
    db.prepare("DELETE FROM album_fields WHERE album_id = ?").bind(albumId),
    ...fields.map((field, index) =>
      db.prepare(
        `
        INSERT INTO album_fields (
          id, album_id, label, value, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      ).bind(
        crypto.randomUUID(),
        albumId,
        field.label,
        field.value,
        index,
        now,
        now
      )
    ),
    db.prepare("UPDATE albums SET updated_at = ? WHERE id = ?").bind(now, albumId)
  ];

  await db.batch(statements);
  return listAlbumFields(db, albumId);
}

export async function getAlbum(db: D1Database, albumId: string): Promise<Album | null> {
  const row = await db
    .prepare(
      `
      SELECT
        a.*,
        COALESCE(stats.image_count, 0) AS image_count,
        COALESCE(stats.total_size_bytes, 0) AS total_size_bytes,
        cover.id AS cover_id,
        cover.album_id AS cover_album_id,
        cover.r2_key AS cover_r2_key,
        cover.filename AS cover_filename,
        cover.content_type AS cover_content_type,
        cover.size_bytes AS cover_size_bytes,
        cover.width AS cover_width,
        cover.height AS cover_height,
        cover.title AS cover_title,
        cover.description AS cover_description,
        cover.sort_order AS cover_sort_order,
        cover.created_at AS cover_created_at,
        cover.updated_at AS cover_updated_at
      FROM albums a
      LEFT JOIN (
        SELECT album_id, COUNT(*) AS image_count, COALESCE(SUM(size_bytes), 0) AS total_size_bytes
        FROM images
        GROUP BY album_id
      ) stats ON stats.album_id = a.id
      LEFT JOIN images cover ON cover.id = a.cover_image_id
      WHERE a.id = ?
      `
    )
    .bind(albumId)
    .first<AlbumListRow>();

  return row ? toAlbum(row) : null;
}

export async function updateAlbum(
  db: D1Database,
  albumId: string,
  input: {
    title?: string;
    description?: string;
    isPublic?: boolean;
    coverImageId?: string | null;
    now: string;
  }
): Promise<Album | null> {
  const current = await getAlbum(db, albumId);
  if (!current) {
    return null;
  }

  await db
    .prepare(
      `
      UPDATE albums
      SET title = ?, description = ?, is_public = ?, cover_image_id = ?, updated_at = ?
      WHERE id = ?
      `
    )
    .bind(
      input.title ?? current.title,
      input.description ?? current.description,
      (input.isPublic ?? current.is_public) ? 1 : 0,
      input.coverImageId === undefined ? current.cover_image_id : input.coverImageId,
      input.now,
      albumId
    )
    .run();

  return getAlbum(db, albumId);
}

export async function deleteAlbum(db: D1Database, albumId: string): Promise<void> {
  await db.prepare("DELETE FROM albums WHERE id = ?").bind(albumId).run();
}

export async function listImages(db: D1Database, albumId: string): Promise<StoredImage[]> {
  const result = await db
    .prepare(
      `
      SELECT *
      FROM images
      WHERE album_id = ?
      ORDER BY sort_order ASC, created_at DESC, id ASC
      `
    )
    .bind(albumId)
    .all<StoredImage>();

  return (result.results ?? []).map(toImage);
}

export async function listImageIdentities(
  db: D1Database,
  albumId: string
): Promise<Array<{ filename: string; sizeBytes: number; contentType: string }>> {
  const result = await db
    .prepare("SELECT filename, size_bytes, content_type FROM images WHERE album_id = ?")
    .bind(albumId)
    .all<{ filename: string; size_bytes: number | string; content_type: string }>();

  return (result.results ?? []).map((row) => ({
    filename: row.filename,
    sizeBytes: toNumber(row.size_bytes),
    contentType: row.content_type
  }));
}

export async function findDuplicateImage(
  db: D1Database,
  albumId: string,
  identity: { filename: string; sizeBytes: number; contentType: string }
): Promise<StoredImage | null> {
  const row = await db
    .prepare(
      `
      SELECT * FROM images
      WHERE album_id = ? AND filename = ? AND size_bytes = ? AND content_type = ?
      LIMIT 1
      `
    )
    .bind(albumId, identity.filename, identity.sizeBytes, identity.contentType)
    .first<StoredImage>();

  return row ? toImage(row) : null;
}

export async function listAlbumImagesForDelete(
  db: D1Database,
  albumId: string
): Promise<Array<Pick<StoredImage, "id" | "r2_key">>> {
  const result = await db
    .prepare("SELECT id, r2_key FROM images WHERE album_id = ?")
    .bind(albumId)
    .all<Pick<StoredImage, "id" | "r2_key">>();

  return result.results ?? [];
}

export async function getImage(db: D1Database, imageId: string): Promise<StoredImage | null> {
  const row = await db.prepare("SELECT * FROM images WHERE id = ?").bind(imageId).first<StoredImage>();
  return row ? toImage(row) : null;
}

export async function createImage(
  db: D1Database,
  input: {
    id: string;
    albumId: string;
    r2Key: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    title: string;
    description: string;
    now: string;
  }
): Promise<StoredImage> {
  const maxSortRow = await db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order FROM images WHERE album_id = ?")
    .bind(input.albumId)
    .first<{ next_sort_order: number | string }>();

  const sortOrder = toNumber(maxSortRow?.next_sort_order);

  await db
    .prepare(
      `
      INSERT INTO images (
        id, album_id, r2_key, filename, content_type, size_bytes,
        width, height, title, description, sort_order, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      input.id,
      input.albumId,
      input.r2Key,
      input.filename,
      input.contentType,
      input.sizeBytes,
      input.width,
      input.height,
      input.title,
      input.description,
      sortOrder,
      input.now,
      input.now
    )
    .run();

  const album = await getAlbum(db, input.albumId);
  if (album && !album.cover_image_id) {
    await db
      .prepare("UPDATE albums SET cover_image_id = ?, updated_at = ? WHERE id = ?")
      .bind(input.id, input.now, input.albumId)
      .run();
  } else {
    await db.prepare("UPDATE albums SET updated_at = ? WHERE id = ?").bind(input.now, input.albumId).run();
  }

  const image = await getImage(db, input.id);
  if (!image) {
    throw new Error("Created image could not be read back");
  }

  return image;
}

export async function updateImage(
  db: D1Database,
  imageId: string,
  input: { title?: string; description?: string; sortOrder?: number; now: string }
): Promise<StoredImage | null> {
  const current = await getImage(db, imageId);
  if (!current) {
    return null;
  }

  await db
    .prepare(
      `
      UPDATE images
      SET title = ?, description = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
      `
    )
    .bind(
      input.title ?? current.title,
      input.description ?? current.description,
      input.sortOrder ?? current.sort_order,
      input.now,
      imageId
    )
    .run();

  await db.prepare("UPDATE albums SET updated_at = ? WHERE id = ?").bind(input.now, current.album_id).run();

  return getImage(db, imageId);
}

export async function deleteImage(db: D1Database, imageId: string): Promise<void> {
  const current = await getImage(db, imageId);
  if (!current) {
    return;
  }

  await db.prepare("DELETE FROM images WHERE id = ?").bind(imageId).run();

  const coverAlbum = await db
    .prepare("SELECT id FROM albums WHERE id = ? AND cover_image_id = ?")
    .bind(current.album_id, imageId)
    .first<{ id: string }>();

  const replacement = await db
    .prepare(
      `
      SELECT id FROM images
      WHERE album_id = ?
      ORDER BY sort_order ASC, created_at DESC, id ASC
      LIMIT 1
      `
    )
    .bind(current.album_id)
    .first<{ id: string }>();

  if (coverAlbum) {
    await db
      .prepare("UPDATE albums SET cover_image_id = ?, updated_at = ? WHERE id = ?")
      .bind(replacement?.id ?? null, new Date().toISOString(), current.album_id)
      .run();
  } else {
    await db
      .prepare("UPDATE albums SET updated_at = ? WHERE id = ?")
      .bind(new Date().toISOString(), current.album_id)
      .run();
  }
}

function toAlbum(row: AlbumListRow): Album {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    album_type: row.album_type === "setting" ? "setting" : "album",
    is_public: toBoolean(row.is_public),
    cover_image_id: row.cover_image_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    image_count: toNumber(row.image_count),
    total_size_bytes: toNumber(row.total_size_bytes),
    cover_image: toBoolean(row.is_public) && row.cover_id
      ? {
          id: row.cover_id,
          album_id: row.cover_album_id ?? row.id,
          content_type: row.cover_content_type ?? "application/octet-stream",
          size_bytes: toNumber(row.cover_size_bytes),
          width: toNullableNumber(row.cover_width),
          height: toNullableNumber(row.cover_height),
          description: row.cover_description ?? "",
          created_at: row.cover_created_at ?? row.created_at,
          updated_at: row.cover_updated_at ?? row.updated_at
        }
      : null
  };
}

function toImage(row: StoredImage): StoredImage {
  return {
    ...row,
    size_bytes: toNumber(row.size_bytes),
    width: toNullableNumber(row.width),
    height: toNullableNumber(row.height),
    sort_order: toNumber(row.sort_order)
  };
}

export function toGalleryImage(image: StoredImage): GalleryImage {
  return {
    id: image.id,
    album_id: image.album_id,
    content_type: image.content_type,
    size_bytes: image.size_bytes,
    width: image.width,
    height: image.height,
    description: image.description,
    created_at: image.created_at,
    updated_at: image.updated_at
  };
}

function toNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function toBoolean(value: number | string | boolean | null | undefined): boolean {
  return value === true || value === 1 || value === "1";
}
