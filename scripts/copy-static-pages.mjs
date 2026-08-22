import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const pages = [
  "index.html",
  "upload.html",
  "admin/login.html",
  "album-upload.html"
];

for (const page of pages) {
  const source = join(".next", "server", "app", page);
  const target = join(".open-next", "assets", page);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}
