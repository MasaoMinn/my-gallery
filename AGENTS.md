# AGENTS.md

## Project Overview

This workspace is for a web photo gallery application.

The application must be built with Next.js and deployed to Cloudflare Workers. Image binary data must be stored in Cloudflare R2 object storage. Image and album metadata must be stored in Cloudflare D1, which is SQLite-compatible.

The product must support uploading, browsing, creating, editing, and deleting albums and images. Every album and every image must have its own editable description text. Public albums are readable by anyone; private albums and all mutations are available only to the authenticated administrator.

The application should prioritize fast image loading and a responsive browsing experience.

## Primary Goals

- Build a Next.js web application for photo album browsing and management.
- Use `pnpm` for package management and scripts.
- Support album CRUD:
  - Create album.
  - List albums.
  - View album detail.
  - Update album title/description and other metadata.
  - Update album public/private visibility.
  - Restrict non-public albums to the authenticated administrator.
  - Delete album.
- Support image CRUD:
  - Upload images into albums.
  - List images in an album.
  - View image detail.
  - Update image title/description and metadata.
  - Delete image metadata and the corresponding R2 object.
- Store image files in Cloudflare R2.
- Store structured metadata in Cloudflare D1.
- Optimize image delivery and frontend loading speed as much as practical.
- Keep album creation and image upload flows separate from the browsing sidebar.
- Use `/upload` for creating albums only.
- Upload images only from an already-created album, through that album's upload page.

## Technical Stack

- Framework: Next.js.
- Runtime/deployment target: Cloudflare Workers.
- Object storage: Cloudflare R2.
- Database: Cloudflare D1.
- Database type: SQLite-compatible schema and queries.
- Language preference: TypeScript.

Before implementing Cloudflare-specific runtime, bindings, deployment, or Next.js adapter behavior, check the current official Cloudflare and Next.js documentation because platform support and recommended adapters can change.

## Expected Data Model

Use a simple relational model unless product requirements change.

### albums

Suggested fields:

- `id`: stable unique identifier.
- `title`: album title.
- `description`: album description text.
- `is_public`: whether the album can be viewed without administrator authentication.
- `access_key`: retained only for database compatibility; do not use it for access control.
- `cover_image_id`: optional image used as album cover.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

### images

Suggested fields:

- `id`: stable unique identifier.
- `album_id`: parent album id.
- `r2_key`: object key in R2.
- `filename`: original filename.
- `content_type`: MIME type.
- `size_bytes`: file size.
- `width`: optional pixel width.
- `height`: optional pixel height.
- `title`: optional image title.
- `description`: image description text.
- `sort_order`: optional ordering value inside an album.
- `created_at`: creation timestamp.
- `updated_at`: update timestamp.

## Architecture Guidelines

- Keep R2 object keys stable and non-guessable. Prefer generated ids or content-addressed paths instead of raw user filenames.
- Treat D1 as the source of truth for metadata and R2 as the source of truth for binary image data.
- Keep database writes and R2 writes coordinated. If upload metadata creation fails, avoid leaving unused R2 objects where possible.
- Encapsulate Cloudflare bindings behind small server-side helper modules so UI code does not depend directly on runtime-specific APIs.
- Keep server-only code clearly separated from client components.
- Use typed request validation for all mutations.
- Prefer predictable pagination over loading entire albums at once.
- Prefer optimistic UI only where rollback behavior is clear.

## Image Loading And Performance Requirements

Implementation should prioritize fast perceived loading:

- Generate and store image dimensions during upload when possible.
- Use responsive image sizes and avoid layout shift.
- Use thumbnails or smaller variants for gallery grids.
- Lazy-load below-the-fold images.
- Use cache-friendly R2 object keys and HTTP headers.
- Use pagination, infinite scroll, or virtualized grids for large albums.
- Avoid loading original full-resolution images in album grids.
- Consider storing derived variants such as thumbnail, medium, and original if Cloudflare image resizing is not used.
- Keep image metadata sufficient for rendering placeholders and correct aspect ratios.

Do not assume Next.js default image optimization works unchanged on Cloudflare Workers. Verify the deployed runtime support before relying on it.

## CRUD Behavior Expectations

- Deleting an album should define what happens to its images before implementation:
  - Either cascade delete all images and R2 objects.
  - Or block deletion until the album is empty.
- Deleting an image must remove both D1 metadata and the R2 object, or record a recoverable cleanup task if one side fails.
- Updating descriptions should be independent from replacing image files.
- Image descriptions should appear on the gallery grid as semi-transparent hover overlays. Clicking opens a read-only large preview; authenticated administrators can explicitly enter edit mode below it.
- Album and image list APIs should support stable ordering.

## Security And Validation

Use the signed, HttpOnly administrator session cookie for browser mutations. Visitors may only read public albums and images.

At minimum, implementation should include:

- Server-side file type validation.
- File size limits.
- Rejection of unsupported image formats.
- Safe handling of filenames.
- Mutation routes protected according to the chosen auth model.
- No public write access to R2.
- No secrets committed to the repository.

## Suggested Project Structure

The final structure may vary, but keep responsibilities clear:

- `app/`: Next.js routes, layouts, pages, and route handlers.
- `components/`: reusable UI components.
- `lib/db/`: D1 schema, queries, and migration helpers.
- `lib/r2/`: R2 upload, delete, and object URL helpers.
- `lib/images/`: image validation, metadata extraction, and variant logic.
- `lib/validation/`: shared schemas for request validation.
- `migrations/`: D1 database migrations.
- `wrangler.toml`: Cloudflare Worker, D1, and R2 bindings.

This project currently uses `wrangler.jsonc` instead of `wrangler.toml`.

## Development Workflow

- Prefer small, focused changes.
- Use `pnpm`, not npm or yarn.
- Preserve user edits in the working tree.
- Add tests around database queries, validation, and mutation behavior where practical.
- For frontend changes, verify key flows in a browser:
  - Album list.
  - Album detail.
  - Image upload.
  - Image edit.
  - Image delete.
  - Responsive grid behavior.
- For Cloudflare-specific functionality, test with local Wrangler bindings where possible.

## Open Product Questions

These questions should be answered before or during implementation:

1. Should the gallery be public, private, or mixed?
2. Is user authentication required? If yes, who can upload, edit, or delete content?
3. Should albums support custom cover images?
4. Should images support titles in addition to descriptions?
5. Should album/image ordering be manual, chronological, or both?
6. What image formats should be accepted? For example: JPEG, PNG, WebP, AVIF, GIF.
7. What is the maximum upload size per image?
8. Should the app generate image variants itself, use Cloudflare Images/Image Resizing, or store only originals in R2?
9. Should original full-resolution images be downloadable?
10. What should happen when deleting an album that contains images?
11. Is EXIF metadata needed, and should GPS metadata be stripped for privacy?
12. Should there be search, tags, favorites, or only albums and images?
13. Should the UI language be Chinese, English, or multilingual?

## Current Assumptions

Until clarified, assume:

- The first version is a single-owner gallery/admin application.
- Visitors can browse public albums only; private albums are administrator-only.
- The user-facing UI should not show an administrator token field. Images are stored through the configured server-side R2 binding.
- `GALLERY_ADMIN_TOKEN` is required for all writes and must be stored as a Worker secret.
- Image descriptions are plain text, not rich text.
- The UI should be responsive and usable on desktop and mobile.
- The implementation should start simple, then add advanced optimization once the core upload/browse flow works.
