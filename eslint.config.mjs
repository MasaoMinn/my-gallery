import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      ".wrangler-dry-run/**",
      "cloudflare-env.d.ts"
    ]
  }
];

export default config;
