import { getAlbum, getImage, getPrivateAlbumAccessKey } from "@/lib/db/gallery";
import { getBindings } from "@/lib/cloudflare";
import { assertAlbumAccessKey } from "@/lib/http/admin";
import { unwrapParams } from "@/lib/http/params";
import { handleRouteError, HttpError } from "@/lib/http/responses";

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
    assertAlbumAccessKey(request, env, album, await getPrivateAlbumAccessKey(env.DB));

    const object = await env.GALLERY_BUCKET.get(image.r2_key);
    if (!object) {
      throw new HttpError(404, "图片文件不存在", "image_object_not_found");
    }

    const headers = new Headers();
    const metadata = object.httpMetadata;
    headers.set("content-type", metadata?.contentType ?? image.content_type);
    if (metadata?.contentEncoding) {
      headers.set("content-encoding", metadata.contentEncoding);
    }
    if (metadata?.contentLanguage) {
      headers.set("content-language", metadata.contentLanguage);
    }
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public,max-age=31536000,immutable");
    headers.set("content-disposition", `inline; filename="${encodeURIComponent(image.filename)}"`);
    if (object.uploaded) {
      headers.set("last-modified", object.uploaded.toUTCString());
    }

    if (etagMatches(request.headers.get("if-none-match"), object.httpEtag)) {
      return new Response(null, { headers, status: 304 });
    }

    return new Response(object.body, { headers });
  } catch (error) {
    return handleRouteError(error);
  }
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
