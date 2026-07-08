import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getBindings(): CloudflareEnv {
  return getCloudflareContext().env as CloudflareEnv;
}
