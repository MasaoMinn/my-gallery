import { AlbumUploadManager } from "@/components/album-upload-manager";
import { AdminOnly } from "@/components/admin-only";

type PageProps = {
  params: Promise<{ albumId: string }>;
};

export default async function AlbumUploadPage({ params }: PageProps) {
  const { albumId } = await params;
  return <AdminOnly><AlbumUploadManager albumId={albumId} /></AdminOnly>;
}
