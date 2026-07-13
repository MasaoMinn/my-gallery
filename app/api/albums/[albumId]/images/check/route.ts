import { getBindings } from "@/lib/cloudflare";
import { getAlbum, listImageIdentities } from "@/lib/db/gallery";
import { requireAdmin } from "@/lib/http/admin";
import { unwrapParams } from "@/lib/http/params";
import { handleRouteError, HttpError, ok } from "@/lib/http/responses";
import { imageIdentityKey } from "@/lib/images/identity";
import { imageDuplicateCheckSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ albumId: string }>;
};

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const { albumId } = await unwrapParams(context.params);
    const env = getBindings();
    await requireAdmin(request, env);

    if (!(await getAlbum(env.DB, albumId))) {
      throw new HttpError(404, "相册不存在", "album_not_found");
    }

    const input = imageDuplicateCheckSchema.parse(await request.json());
    const existingKeys = new Set(
      (await listImageIdentities(env.DB, albumId)).map(imageIdentityKey)
    );
    const duplicateIds = input.files
      .filter((file) => existingKeys.has(imageIdentityKey(file)))
      .map((file) => file.clientId);

    return ok({ duplicateIds });
  } catch (error) {
    return handleRouteError(error);
  }
}
