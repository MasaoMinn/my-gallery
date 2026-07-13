import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = {
  ...defineCloudflareConfig({}),
  buildCommand: "pnpm exec next build --webpack",
};

export default config;
