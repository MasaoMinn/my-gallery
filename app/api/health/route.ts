import { getBindings } from "@/lib/cloudflare";
import { handleRouteError, ok } from "@/lib/http/responses";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const env = getBindings();
    await env.DB.prepare("SELECT 1").first();
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
