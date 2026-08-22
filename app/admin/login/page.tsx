import { Suspense } from "react";
import { AdminLogin } from "@/components/admin-login";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="auth-page"><p>正在加载登录页面</p></main>}>
      <AdminLogin />
    </Suspense>
  );
}
