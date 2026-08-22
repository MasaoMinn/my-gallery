import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ albumId: string }>;
};

export default async function AlbumUploadPage({ params }: PageProps) {
  const { albumId } = await params;
  redirect(`/album-upload?albumId=${encodeURIComponent(albumId)}`);
}
