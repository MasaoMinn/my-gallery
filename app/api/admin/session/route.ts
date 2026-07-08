import { getBindings } from "@/lib/cloudflare";
import { requireAdmin } from "@/lib/http/admin";
import { handleRouteError, ok } from "@/lib/http/responses";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const env = getBindings();
    return ok({
      tokenConfigured: Boolean(env.GALLERY_ADMIN_TOKEN?.trim()),
      maxUploadMb: Number(env.GALLERY_MAX_UPLOAD_MB ?? "10")
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const env = getBindings();
    requireAdmin(request, env);
    return ok({ authenticated: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
