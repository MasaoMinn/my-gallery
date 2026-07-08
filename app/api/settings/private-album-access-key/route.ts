import { getPrivateAlbumAccessKey, updatePrivateAlbumAccessKey } from "@/lib/db/gallery";
import { getBindings } from "@/lib/cloudflare";
import { requireAdmin } from "@/lib/http/admin";
import { handleRouteError, ok } from "@/lib/http/responses";
import { privateAlbumAccessKeyUpdateSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const env = getBindings();
    return ok({ hasAccessKey: Boolean(await getPrivateAlbumAccessKey(env.DB)) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const env = getBindings();
    requireAdmin(request, env);

    const input = privateAlbumAccessKeyUpdateSchema.parse(await request.json());
    return ok(
      await updatePrivateAlbumAccessKey(env.DB, {
        accessKey: input.accessKey,
        now: new Date().toISOString()
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
