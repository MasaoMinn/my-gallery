"use client";

import { AdminOnly } from "@/components/admin-only";
import { AlbumUploadManager } from "@/components/album-upload-manager";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function AlbumUploadPageContent() {
  const albumId = useSearchParams().get("albumId")?.trim();

  if (!albumId) {
    return (
      <main className="auth-page">
        <p className="form-error" role="alert">缺少相册标识，无法打开上传页面。</p>
        <Link className="secondary-button" href="/">返回相册</Link>
      </main>
    );
  }

  return (
    <AdminOnly>
      <AlbumUploadManager albumId={albumId} />
    </AdminOnly>
  );
}
