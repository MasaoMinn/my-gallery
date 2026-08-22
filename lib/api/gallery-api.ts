import {
  createAlbum,
  createImage,
  deleteAlbum,
  deleteImage,
  findDuplicateImage,
  getAlbum,
  getImage,
  listAlbumImagesForDelete,
  listAlbums,
  listImageIdentities,
  listImages,
  toGalleryImage,
  updateAlbum,
  updateImage
} from "@/lib/db/gallery";
import {
  clearAdminSessionCookie,
  createAdminSession,
  createAdminSessionCookie,
  verifyAdminToken
} from "@/lib/auth/admin-session";
import { HttpError } from "@/lib/http/errors";
import {
  configuredAdminToken,
  isAdminRequest,
  requireAdmin,
  requireAlbumReadAccess,
  requireRequestOrigin
} from "@/lib/http/admin";
import { imageIdentityKey } from "@/lib/images/identity";
import { decodeUploadHeader, IMAGE_UPLOAD_HEADERS } from "@/lib/images/upload-protocol";
import { assertUploadableImageMetadata } from "@/lib/images/validation";
import {
  createImageObjectKey,
  deleteImageObject,
  putImageObject
} from "@/lib/r2/gallery-bucket";

type ApiRoute =
  | { kind: "health" }
  | { kind: "admin-session" }
  | { kind: "albums" }
  | { kind: "album"; albumId: string }
  | { kind: "album-images"; albumId: string }
  | { kind: "album-images-check"; albumId: string }
  | { kind: "image"; imageId: string }
  | { kind: "image-asset"; imageId: string };

export async function handleGalleryApiRequest(
  request: Request,
  env: CloudflareEnv
): Promise<Response> {
  try {
    const route = matchApiRoute(new URL(request.url).pathname);
    if (!route) {
      throw new HttpError(404, "接口不存在", "api_not_found");
    }

    switch (route.kind) {
      case "health":
        return request.method === "GET" ? getHealth(env) : methodNotAllowed(["GET"]);
      case "admin-session":
        return handleAdminSession(request, env);
      case "albums":
        return handleAlbums(request, env);
      case "album":
        return handleAlbum(request, env, route.albumId);
      case "album-images":
        return handleAlbumImages(request, env, route.albumId);
      case "album-images-check":
        return request.method === "POST"
          ? checkAlbumImages(request, env, route.albumId)
          : methodNotAllowed(["POST"]);
      case "image":
        return handleImage(request, env, route.imageId);
      case "image-asset":
        return request.method === "GET"
          ? getImageAsset(request, env, route.imageId)
          : methodNotAllowed(["GET"]);
    }
  } catch (error) {
    return handleApiError(error);
  }
}

function matchApiRoute(pathname: string): ApiRoute | null {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] !== "api") {
    return null;
  }
  if (parts.length === 2 && parts[1] === "health") {
    return { kind: "health" };
  }
  if (parts.length === 3 && parts[1] === "admin" && parts[2] === "session") {
    return { kind: "admin-session" };
  }
  if (parts.length === 2 && parts[1] === "albums") {
    return { kind: "albums" };
  }
  if (parts.length === 3 && parts[1] === "albums") {
    return { kind: "album", albumId: parts[2] };
  }
  if (parts.length === 4 && parts[1] === "albums" && parts[3] === "images") {
    return { kind: "album-images", albumId: parts[2] };
  }
  if (
    parts.length === 5 &&
    parts[1] === "albums" &&
    parts[3] === "images" &&
    parts[4] === "check"
  ) {
    return { kind: "album-images-check", albumId: parts[2] };
  }
  if (parts.length === 3 && parts[1] === "images") {
    return { kind: "image", imageId: parts[2] };
  }
  if (parts.length === 4 && parts[1] === "images" && parts[3] === "asset") {
    return { kind: "image-asset", imageId: parts[2] };
  }
  return null;
}

async function getHealth(env: CloudflareEnv): Promise<Response> {
  await env.DB.prepare("SELECT 1").first();
  return dataResponse({ ok: true });
}

async function handleAdminSession(request: Request, env: CloudflareEnv): Promise<Response> {
  if (request.method === "GET") {
    return noStore(
      dataResponse({
        authenticated: await isAdminRequest(request, env),
        tokenConfigured: Boolean(env.GALLERY_ADMIN_TOKEN?.trim()),
        maxUploadMb: Number(env.GALLERY_MAX_UPLOAD_MB ?? "95")
      })
    );
  }

  if (request.method === "POST") {
    requireRequestOrigin(request);
    const { adminLoginSchema } = await import("@/lib/validation/schemas");
    const configuredToken = configuredAdminToken(env);
    const input = adminLoginSchema.parse(await request.json());
    if (!(await verifyAdminToken(input.token, configuredToken))) {
      throw new HttpError(401, "管理员密钥无效", "unauthorized");
    }

    const response = dataResponse({ authenticated: true });
    response.headers.set(
      "set-cookie",
      createAdminSessionCookie(request, await createAdminSession(configuredToken))
    );
    return noStore(response);
  }

  if (request.method === "DELETE") {
    requireRequestOrigin(request);
    const response = dataResponse({ authenticated: false });
    response.headers.set("set-cookie", clearAdminSessionCookie(request));
    return noStore(response);
  }

  return methodNotAllowed(["GET", "POST", "DELETE"]);
}

async function handleAlbums(request: Request, env: CloudflareEnv): Promise<Response> {
  if (request.method === "GET") {
    return dataResponse(await listAlbums(env.DB, await isAdminRequest(request, env)));
  }
  if (request.method === "POST") {
    await requireAdmin(request, env);
    const { albumCreateSchema } = await import("@/lib/validation/schemas");
    const input = albumCreateSchema.parse(await request.json());
    const now = new Date().toISOString();
    const album = await createAlbum(env.DB, {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      isPublic: input.isPublic,
      now
    });
    return dataResponse(album, 201);
  }
  return methodNotAllowed(["GET", "POST"]);
}

async function handleAlbum(
  request: Request,
  env: CloudflareEnv,
  albumId: string
): Promise<Response> {
  if (request.method === "GET") {
    const album = await requireExistingAlbum(env, albumId);
    await requireAlbumReadAccess(request, env, album);
    return dataResponse(album);
  }

  if (request.method === "PATCH") {
    await requireAdmin(request, env);
    const { albumUpdateSchema } = await import("@/lib/validation/schemas");
    const input = albumUpdateSchema.parse(await request.json());
    await requireExistingAlbum(env, albumId);
    const album = await updateAlbum(env.DB, albumId, {
      title: input.title,
      description: input.description,
      isPublic: input.isPublic,
      coverImageId: input.coverImageId,
      now: new Date().toISOString()
    });
    if (!album) {
      throw new HttpError(404, "相册不存在", "album_not_found");
    }
    return dataResponse(album);
  }

  if (request.method === "DELETE") {
    await requireAdmin(request, env);
    await requireExistingAlbum(env, albumId);
    const images = await listAlbumImagesForDelete(env.DB, albumId);
    await Promise.all(images.map((image) => deleteImageObject(env.GALLERY_BUCKET, image.r2_key)));
    await deleteAlbum(env.DB, albumId);
    return new Response(null, { status: 204 });
  }

  return methodNotAllowed(["GET", "PATCH", "DELETE"]);
}

async function handleAlbumImages(
  request: Request,
  env: CloudflareEnv,
  albumId: string
): Promise<Response> {
  if (request.method === "GET") {
    const album = await requireExistingAlbum(env, albumId);
    await requireAlbumReadAccess(request, env, album);
    return dataResponse((await listImages(env.DB, albumId)).map(toGalleryImage));
  }

  if (request.method === "POST") {
    await requireAdmin(request, env);
    await requireExistingAlbum(env, albumId);
    return uploadImage(request, env, albumId);
  }

  return methodNotAllowed(["GET", "POST"]);
}

async function uploadImage(
  request: Request,
  env: CloudflareEnv,
  albumId: string
): Promise<Response> {
  if (!request.body) {
    throw new HttpError(400, "缺少图片文件", "file_missing");
  }

  const filename = decodeUploadHeader(request.headers.get(IMAGE_UPLOAD_HEADERS.filename));
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim() ?? "";
  const sizeBytes = parseRequiredInteger(
    request.headers.get(IMAGE_UPLOAD_HEADERS.size),
    "图片大小无效"
  );
  if (!filename || filename.length > 512) {
    throw new HttpError(400, "图片文件名无效", "invalid_filename");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) !== sizeBytes) {
    throw new HttpError(400, "图片大小与请求内容不一致", "invalid_file_size");
  }
  assertUploadableImageMetadata({ contentType, sizeBytes }, env);

  const duplicate = await findDuplicateImage(env.DB, albumId, {
    filename,
    sizeBytes,
    contentType
  });
  if (duplicate) {
    return dataResponse({ image: toGalleryImage(duplicate), duplicate: true });
  }

  const { imageUploadMetadataSchema } = await import("@/lib/validation/schemas");
  const metadata = imageUploadMetadataSchema.parse({
    title: decodeUploadHeader(request.headers.get(IMAGE_UPLOAD_HEADERS.title)),
    description: decodeUploadHeader(request.headers.get(IMAGE_UPLOAD_HEADERS.description))
  });
  const width = parseOptionalDimension(request.headers.get(IMAGE_UPLOAD_HEADERS.width));
  const height = parseOptionalDimension(request.headers.get(IMAGE_UPLOAD_HEADERS.height));
  const imageId = crypto.randomUUID();
  const r2Key = createImageObjectKey(albumId, imageId, filename, contentType);
  const now = new Date().toISOString();

  const object = await putImageObject(env.GALLERY_BUCKET, r2Key, request.body, {
    albumId,
    imageId,
    filename,
    contentType,
    sizeBytes
  });
  if (object.size !== sizeBytes) {
    await deleteImageObject(env.GALLERY_BUCKET, r2Key);
    throw new HttpError(400, "图片大小与上传内容不一致", "invalid_file_size");
  }

  try {
    const image = await createImage(env.DB, {
      id: imageId,
      albumId,
      r2Key,
      filename,
      contentType,
      sizeBytes: object.size,
      width,
      height,
      title: metadata.title,
      description: metadata.description,
      now
    });
    return dataResponse({ image: toGalleryImage(image), duplicate: false }, 201);
  } catch (error) {
    await deleteImageObject(env.GALLERY_BUCKET, r2Key);
    throw error;
  }
}

async function checkAlbumImages(
  request: Request,
  env: CloudflareEnv,
  albumId: string
): Promise<Response> {
  await requireAdmin(request, env);
  await requireExistingAlbum(env, albumId);
  const { imageDuplicateCheckSchema } = await import("@/lib/validation/schemas");
  const input = imageDuplicateCheckSchema.parse(await request.json());
  const existingKeys = new Set(
    (await listImageIdentities(env.DB, albumId)).map(imageIdentityKey)
  );
  return dataResponse({
    duplicateIds: input.files
      .filter((file) => existingKeys.has(imageIdentityKey(file)))
      .map((file) => file.clientId)
  });
}

async function handleImage(
  request: Request,
  env: CloudflareEnv,
  imageId: string
): Promise<Response> {
  if (request.method === "GET") {
    const image = await requireExistingImage(env, imageId);
    const album = await requireExistingAlbum(env, image.album_id);
    await requireAlbumReadAccess(request, env, album);
    return dataResponse(toGalleryImage(image));
  }

  if (request.method === "PATCH") {
    await requireAdmin(request, env);
    const { imageUpdateSchema } = await import("@/lib/validation/schemas");
    const input = imageUpdateSchema.parse(await request.json());
    const image = await updateImage(env.DB, imageId, {
      title: input.title,
      description: input.description,
      sortOrder: input.sortOrder,
      now: new Date().toISOString()
    });
    if (!image) {
      throw new HttpError(404, "图片不存在", "image_not_found");
    }
    return dataResponse(toGalleryImage(image));
  }

  if (request.method === "DELETE") {
    await requireAdmin(request, env);
    const image = await requireExistingImage(env, imageId);
    await deleteImageObject(env.GALLERY_BUCKET, image.r2_key);
    await deleteImage(env.DB, imageId);
    return new Response(null, { status: 204 });
  }

  return methodNotAllowed(["GET", "PATCH", "DELETE"]);
}

async function getImageAsset(
  request: Request,
  env: CloudflareEnv,
  imageId: string
): Promise<Response> {
  const image = await requireExistingImage(env, imageId);
  const album = await requireExistingAlbum(env, image.album_id);
  await requireAlbumReadAccess(request, env, album);

  const rangeRequested = request.headers.has("range");
  const object = await env.GALLERY_BUCKET.get(
    image.r2_key,
    rangeRequested ? { range: request.headers } : undefined
  );
  if (!object || !("body" in object)) {
    throw new HttpError(404, "图片文件不存在", "image_object_not_found");
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", object.httpMetadata?.contentType ?? image.content_type);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set(
    "cache-control",
    album.is_public ? "public,max-age=31536000,immutable" : "private,no-store"
  );
  headers.set("content-disposition", `inline; filename="${encodeURIComponent(image.filename)}"`);
  headers.set("last-modified", object.uploaded.toUTCString());

  if (etagMatches(request.headers.get("if-none-match"), object.httpEtag)) {
    return new Response(null, { headers, status: 304 });
  }
  if (rangeRequested && object.range) {
    const { offset, length } = normalizeRange(object.range, object.size);
    headers.set("content-range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { headers, status: 206 });
  }

  headers.set("content-length", String(object.size));
  return new Response(object.body, { headers });
}

async function requireExistingAlbum(env: CloudflareEnv, albumId: string) {
  const album = await getAlbum(env.DB, albumId);
  if (!album) {
    throw new HttpError(404, "相册不存在", "album_not_found");
  }
  return album;
}

async function requireExistingImage(env: CloudflareEnv, imageId: string) {
  const image = await getImage(env.DB, imageId);
  if (!image) {
    throw new HttpError(404, "图片不存在", "image_not_found");
  }
  return image;
}

function dataResponse<T>(data: T, status = 200): Response {
  return Response.json({ data }, { status });
}

function methodNotAllowed(allowed: string[]): Response {
  return Response.json(
    { error: { code: "method_not_allowed", message: "请求方法不受支持" } },
    { status: 405, headers: { allow: allowed.join(", ") } }
  );
}

function handleApiError(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status }
    );
  }
  if (isZodError(error)) {
    return Response.json(
      { error: { code: "validation_error", message: "请求参数无效", issues: error.issues } },
      { status: 400 }
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "internal_error", message: "服务器内部错误" } },
    { status: 500 }
  );
}

function isZodError(error: unknown): error is { name: "ZodError"; issues: unknown[] } {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ZodError" &&
      "issues" in error &&
      Array.isArray(error.issues)
  );
}

function noStore(response: Response): Response {
  response.headers.set("cache-control", "no-store");
  return response;
}

function parseRequiredInteger(value: string | null, message: string): number {
  const parsed = Number(value);
  if (!value || !Number.isSafeInteger(parsed)) {
    throw new HttpError(400, message, "invalid_upload_metadata");
  }
  return parsed;
}

function parseOptionalDimension(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100_000 ? parsed : null;
}

function normalizeRange(range: R2Range, objectSize: number): { offset: number; length: number } {
  if ("suffix" in range && typeof range.suffix === "number") {
    const length = Math.min(range.suffix, objectSize);
    return { offset: objectSize - length, length };
  }
  const offset = "offset" in range && typeof range.offset === "number" ? range.offset : 0;
  return {
    offset,
    length:
      "length" in range && typeof range.length === "number"
        ? range.length
        : Math.max(0, objectSize - offset)
  };
}

function etagMatches(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) {
    return false;
  }
  const normalizedEtag = normalizeEtag(etag);
  return ifNoneMatch
    .split(",")
    .map((value) => normalizeEtag(value.trim()))
    .some((value) => value === "*" || value === normalizedEtag);
}

function normalizeEtag(value: string): string {
  return value.replace(/^W\//, "").replace(/^"|"$/g, "");
}
