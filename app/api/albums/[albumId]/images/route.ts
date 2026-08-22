import {
  createImage,
  findDuplicateImage,
  getAlbum,
  listImages,
  toGalleryImage
} from "@/lib/db/gallery";
import { getBindings } from "@/lib/cloudflare";
import { assertUploadableImageMetadata } from "@/lib/images/validation";
import { decodeUploadHeader, IMAGE_UPLOAD_HEADERS } from "@/lib/images/upload-protocol";
import { requireAdmin, requireAlbumReadAccess } from "@/lib/http/admin";
import { unwrapParams } from "@/lib/http/params";
import { created, handleRouteError, HttpError, ok } from "@/lib/http/responses";
import { createImageObjectKey, deleteImageObject, putImageObject } from "@/lib/r2/gallery-bucket";
import { imageUploadMetadataSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ albumId: string }>;
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { albumId } = await unwrapParams(context.params);
    const env = getBindings();

    const album = await getAlbum(env.DB, albumId);
    if (!album) {
      throw new HttpError(404, "相册不存在", "album_not_found");
    }

    await requireAlbumReadAccess(request, env, album);

    return ok((await listImages(env.DB, albumId)).map(toGalleryImage));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { albumId } = await unwrapParams(context.params);
    const env = getBindings();
    await requireAdmin(request, env);

    const album = await getAlbum(env.DB, albumId);
    if (!album) {
      throw new HttpError(404, "相册不存在", "album_not_found");
    }

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
      return ok({ image: toGalleryImage(duplicate), duplicate: true });
    }

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

      return created({ image: toGalleryImage(image), duplicate: false });
    } catch (error) {
      await deleteImageObject(env.GALLERY_BUCKET, r2Key);
      throw error;
    }
  } catch (error) {
    return handleRouteError(error);
  }
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
