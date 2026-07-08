import { AlbumUploadManager } from "@/components/album-upload-manager";

type PageProps = {
  params: Promise<{ albumId: string }>;
};

export default async function AlbumUploadPage({ params }: PageProps) {
  const { albumId } = await params;
  return <AlbumUploadManager albumId={albumId} />;
}
