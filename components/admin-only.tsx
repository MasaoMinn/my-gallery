"use client";

import { useAdminSession } from "@/components/admin-session";
import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function AdminOnly({ children }: { children: React.ReactNode }) {
  const { authenticated, loading } = useAdminSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.toString();
  const returnPath = query ? `${pathname}?${query}` : pathname;

  useEffect(() => {
    if (!loading && !authenticated) {
      router.replace(`/admin/login?next=${encodeURIComponent(returnPath)}`);
    }
  }, [authenticated, loading, returnPath, router]);

  if (loading || !authenticated) {
    return (
      <main className="auth-page">
        <LoaderCircle aria-hidden="true" className="spin" size={32} />
        <p>{loading ? "正在检查管理员会话" : "正在前往管理员登录"}</p>
      </main>
    );
  }

  return children;
}
