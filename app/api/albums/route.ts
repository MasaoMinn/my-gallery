import { createAlbum, listAlbums } from "@/lib/db/gallery";
import { getBindings } from "@/lib/cloudflare";
import { requireAdmin } from "@/lib/http/admin";
import { created, handleRouteError, ok } from "@/lib/http/responses";
import { albumCreateSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const env = getBindings();
    return ok(await listAlbums(env.DB));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const env = getBindings();
    requireAdmin(request, env);

    const input = albumCreateSchema.parse(await request.json());
    const now = new Date().toISOString();
    const album = await createAlbum(env.DB, {
      id: crypto.randomUUID(),
      title: input.title,
      description: input.description,
      isPublic: input.isPublic,
      now
    });

    return created(album);
  } catch (error) {
    return handleRouteError(error);
  }
}
