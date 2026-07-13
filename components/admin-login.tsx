"use client";

import { useAdminSession } from "@/components/admin-session";
import { apiJson } from "@/components/gallery-client";
import { ArrowLeft, KeyRound, LoaderCircle, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export function AdminLogin({ nextPath }: { nextPath: string }) {
  const { authenticated, loading, refresh, tokenConfigured } = useAdminSession();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && authenticated) {
      router.replace(nextPath);
    }
  }, [authenticated, loading, nextPath, router]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await apiJson<{ authenticated: true }>("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      await refresh();
      router.replace(nextPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={login}>
        <Link className="secondary-button compact-button" href="/">
          <ArrowLeft aria-hidden="true" size={16} />
          返回相册
        </Link>
        <div className="auth-icon">
          <KeyRound aria-hidden="true" size={24} />
        </div>
        <div className="panel-heading">
          <p className="section-label">管理员</p>
          <h1>登录管理相册</h1>
          <span>验证一次后，这台浏览器将在 7 天内保持管理员会话。</span>
        </div>
        {loading ? (
          <p className="empty-copy">正在检查管理员配置</p>
        ) : tokenConfigured ? (
          <>
            <label>
              管理员密钥
              <input
                autoComplete="current-password"
                autoFocus
                onChange={(event) => setToken(event.target.value)}
                type="password"
                value={token}
              />
            </label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button className="primary-button" disabled={submitting || !token.trim()} type="submit">
              {submitting ? <LoaderCircle aria-hidden="true" className="spin" size={17} /> : <LogIn aria-hidden="true" size={17} />}
              登录
            </button>
          </>
        ) : (
          <p className="form-error" role="alert">
            尚未配置 GALLERY_ADMIN_TOKEN，所有写操作已关闭。
          </p>
        )}
      </form>
    </main>
  );
}
