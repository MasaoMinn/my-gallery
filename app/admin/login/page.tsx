import { AdminLogin } from "@/components/admin-login";

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  return <AdminLogin nextPath={safeNextPath(next)} />;
}

function safeNextPath(value: string | undefined): string {
  if (!value) {
    return "/";
  }

  try {
    const base = new URL("https://gallery.local");
    const target = new URL(value, base);
    if (target.origin !== base.origin) {
      return "/";
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
