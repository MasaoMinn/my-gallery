import { CreateAlbumManager } from "@/components/create-album-manager";
import { AdminOnly } from "@/components/admin-only";
import { Suspense } from "react";

export default function UploadPage() {
  return (
    <Suspense fallback={<main className="auth-page"><p>正在加载新建相册页面</p></main>}>
      <AdminOnly><CreateAlbumManager /></AdminOnly>
    </Suspense>
  );
}
