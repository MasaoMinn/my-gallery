import { handleGalleryApiRequest } from "@/lib/api/gallery-api";
import { getBindings } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

export function POST(request: Request): Promise<Response> {
  return handleGalleryApiRequest(request, getBindings());
}
