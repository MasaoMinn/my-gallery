import type { Metadata, Viewport } from "next";
import { AdminSessionProvider } from "@/components/admin-session";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Gallery",
  description: "A fast Cloudflare-backed photo gallery for albums and images."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><AdminSessionProvider>{children}</AdminSessionProvider></body>
    </html>
  );
}
