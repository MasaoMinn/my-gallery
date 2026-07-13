import { deleteImage, getAlbum, getImage, toGalleryImage, updateImage } from "@/lib/db/gallery";
import { getBindings } from "@/lib/cloudflare";
import { requireAdmin, requireAlbumReadAccess } from "@/lib/http/admin";
import { unwrapParams } from "@/lib/http/params";
import { handleRouteError, HttpError, noContent, ok } from "@/lib/http/responses";
import { deleteImageObject } from "@/lib/r2/gallery-bucket";
import { imageUpdateSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ imageId: string }> | { imageId: string };
};

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { imageId } = await unwrapParams(context.params);
    const env = getBindings();
    const image = await getImage(env.DB, imageId);

    if (!image) {
      throw new HttpError(404, "图片不存在", "image_not_found");
    }
    const album = await getAlbum(env.DB, image.album_id);
    if (!album) {
      throw new HttpError(404, "相册不存在", "album_not_found");
    }
    await requireAlbumReadAccess(request, env, album);

    return ok(toGalleryImage(image));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { imageId } = await unwrapParams(context.params);
    const env = getBindings();
    await requireAdmin(request, env);

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

    return ok(toGalleryImage(image));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { imageId } = await unwrapParams(context.params);
    const env = getBindings();
    await requireAdmin(request, env);

    const image = await getImage(env.DB, imageId);
    if (!image) {
      throw new HttpError(404, "图片不存在", "image_not_found");
    }

    await deleteImageObject(env.GALLERY_BUCKET, image.r2_key);
    await deleteImage(env.DB, imageId);

    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
