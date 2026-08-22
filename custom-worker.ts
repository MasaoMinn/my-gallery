import { handleGalleryApiRequest } from "@/lib/api/gallery-api";

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname.startsWith("/api/")) {
      return handleGalleryApiRequest(request, env);
    }

    // The OpenNext fallback is generated during the Cloudflare build.
    // @ts-expect-error OpenNext generates this untyped build artifact.
    const { default: handler } = await import("./.open-next/worker.js");
    return handler.fetch(request, env, ctx);
  }
} satisfies ExportedHandler<CloudflareEnv>;
