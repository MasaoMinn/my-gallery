import { createImage, getAlbum, getAlbumAccessKey, listImages } from "@/lib/db/gallery";
import { getBindings } from "@/lib/cloudflare";
import { assertUploadableImage } from "@/lib/images/validation";
import { readImageDimensions } from "@/lib/images/dimensions";
import { assertAlbumAccessKey, requireAdmin } from "@/lib/http/admin";
import { unwrapParams } from "@/lib/http/params";
import { created, handleRouteError, HttpError, ok } from "@/lib/http/responses";
import { createImageObjectKey, deleteImageObject, putImageObject } from "@/lib/r2/gallery-bucket";
import { imageUploadMetadataSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ albumId: string }> | { albumId: string };
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { albumId } = await unwrapParams(context.params);
    const env = getBindings();

    const album = await getAlbum(env.DB, albumId);
    if (!album) {
      throw new HttpError(404, "相册不存在", "album_not_found");
    }

    assertAlbumAccessKey(request, env, album, await getAlbumAccessKey(env.DB, albumId));

    return ok(await listImages(env.DB, albumId));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { albumId } = await unwrapParams(context.params);
    const env = getBindings();
    requireAdmin(request, env);

    const album = await getAlbum(env.DB, albumId);
    if (!album) {
      throw new HttpError(404, "相册不存在", "album_not_found");
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new HttpError(400, "缺少图片文件", "file_missing");
    }

    assertUploadableImage(file, env);

    const metadata = imageUploadMetadataSchema.parse({
      title: formData.get("title")?.toString() ?? "",
      description: formData.get("description")?.toString() ?? ""
    });

    const arrayBuffer = await file.arrayBuffer();
    const dimensions = readImageDimensions(arrayBuffer);
    const imageId = crypto.randomUUID();
    const r2Key = createImageObjectKey(albumId, imageId, file.name, file.type);
    const now = new Date().toISOString();

    await putImageObject(env.GALLERY_BUCKET, r2Key, arrayBuffer, {
      albumId,
      imageId,
      filename: file.name,
      contentType: file.type
    });

    try {
      const image = await createImage(env.DB, {
        id: imageId,
        albumId,
        r2Key,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        title: metadata.title,
        description: metadata.description,
        now
      });

      return created(image);
    } catch (error) {
      await deleteImageObject(env.GALLERY_BUCKET, r2Key);
      throw error;
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
