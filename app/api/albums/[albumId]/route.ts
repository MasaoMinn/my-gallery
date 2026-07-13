import {
  deleteAlbum,
  getAlbum,
  listAlbumImagesForDelete,
  updateAlbum
} from "@/lib/db/gallery";
import { getBindings } from "@/lib/cloudflare";
import { requireAdmin, requireAlbumReadAccess } from "@/lib/http/admin";
import { unwrapParams } from "@/lib/http/params";
import { handleRouteError, HttpError, noContent, ok } from "@/lib/http/responses";
import { deleteImageObject } from "@/lib/r2/gallery-bucket";
import { albumUpdateSchema } from "@/lib/validation/schemas";

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

    await requireAlbumReadAccess(request, env, album);

    return ok(album);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { albumId } = await unwrapParams(context.params);
    const env = getBindings();
    await requireAdmin(request, env);

    const input = albumUpdateSchema.parse(await request.json());
    const current = await getAlbum(env.DB, albumId);
    if (!current) {
      throw new HttpError(404, "相册不存在", "album_not_found");
    }
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

    return ok(album);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { albumId } = await unwrapParams(context.params);
    const env = getBindings();
    await requireAdmin(request, env);

    const album = await getAlbum(env.DB, albumId);
    if (!album) {
      throw new HttpError(404, "相册不存在", "album_not_found");
    }

    const images = await listAlbumImagesForDelete(env.DB, albumId);
    await Promise.all(images.map((image) => deleteImageObject(env.GALLERY_BUCKET, image.r2_key)));
    await deleteAlbum(env.DB, albumId);

    return noContent();
  } catch (error) {
    return handleRouteError(error);
  }
}
