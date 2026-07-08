interface CloudflareEnv {
  DB: D1Database;
  GALLERY_BUCKET: R2Bucket;
  GALLERY_ADMIN_TOKEN?: string;
  GALLERY_MAX_UPLOAD_MB?: string;
  NEXTJS_ENV?: string;
}
