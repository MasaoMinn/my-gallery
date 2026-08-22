import { handleGalleryApiRequest } from "@/lib/api/gallery-api";
import { getBindings } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

function dispatch(request: Request): Promise<Response> {
  return handleGalleryApiRequest(request, getBindings());
}

export const GET = dispatch;
export const POST = dispatch;
