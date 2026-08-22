import { AlbumUploadPageContent } from "@/components/album-upload-page";
import { Suspense } from "react";

export default function AlbumUploadPage() {
  return (
    <Suspense fallback={<main className="auth-page"><p>正在加载上传页面</p></main>}>
      <AlbumUploadPageContent />
    </Suspense>
  );
}
