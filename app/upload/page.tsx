import { CreateAlbumManager } from "@/components/create-album-manager";
import { AdminOnly } from "@/components/admin-only";

export default function UploadPage() {
  return <AdminOnly><CreateAlbumManager /></AdminOnly>;
}
