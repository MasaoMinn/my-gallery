# My Gallery

A Next.js photo gallery for Cloudflare Workers. Images are stored in Cloudflare R2, and album/image metadata is stored in Cloudflare D1.

## Local Development

```powershell
pnpm install
Copy-Item .dev.vars.example .dev.vars
pnpm exec wrangler d1 migrations apply my-gallery-db --local
pnpm run dev
```

Open `http://127.0.0.1:3000`.

- Browse public albums and images on `/`; administrators can log in from the header.
- Create albums on `/upload`.
- Upload images from an opened album on `/albums/{albumId}/upload`.
- Public albums can be opened by anyone. Private albums are visible only to the logged-in administrator.

## Verification

```powershell
pnpm run test
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run test:e2e
```

## Cloudflare Setup

Cloudflare resources were created with the Cloudflare MCP for account `e53e88d84fa1e4aa57c2027cacce45a5`.

Current resources:

- D1 database: `my-gallery-db`
- D1 database id: `bc840dea-611c-43a5-9198-e2bed956d4cd`
- D1 primary region: `WNAM`
- D1 read replication: `auto`
- R2 bucket: `my-gallery-images`
- R2 bucket region: `WNAM`
- R2 storage class: `Standard`

The production D1 schema from `migrations/0001_initial.sql` has already been applied and verified through the Cloudflare D1 API.

Deploy:

```powershell
pnpm run deploy
```

The administrator signs in once at `/admin/login`. The token is exchanged for a signed, HttpOnly seven-day session cookie and is never stored in browser JavaScript or URLs.

`GALLERY_ADMIN_TOKEN` is required and protects every write API. If it is missing, writes fail closed. Configure it as a Worker secret; the retained `albums.access_key` column is no longer used.

## Tokens And Secrets Needed For Deployment

For local interactive deployment, `wrangler login` is enough.

For CI/CD or headless deployment, configure:

- `CLOUDFLARE_API_TOKEN`: Cloudflare API token used by Wrangler to deploy.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account id, useful for CI and multi-account setups.
- `GALLERY_ADMIN_TOKEN`: required high-entropy runtime secret used for administrator login and session signing.

Recommended Cloudflare API token permissions for this app:

- Account: `Workers Scripts:Edit`
- Account: `Workers R2 Storage:Edit`
- Account: `D1:Edit`
- Account: `Account Settings:Read`
- User: `User Details:Read`
- User: `Memberships:Read`
- Zone: `Workers Routes:Edit` only if you attach this Worker to a route/custom domain.

R2 and D1 do not need separate access keys for runtime use. The Worker reads them through bindings in `wrangler.jsonc`.

## References

- Next.js on Cloudflare Workers: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- OpenNext Cloudflare adapter: https://opennext.js.org/cloudflare/get-started
- D1 migrations with Wrangler: https://developers.cloudflare.com/d1/wrangler-commands/
- R2 Workers bindings: https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
