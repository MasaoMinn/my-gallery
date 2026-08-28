import { GalleryApp } from "@/components/gallery-app";

export default async function AlbumDirectPage({
  params
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  return <GalleryApp initialRouteId={routeId} />;
}
