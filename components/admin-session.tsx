"use client";

import { apiJson } from "@/components/gallery-client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AdminSession = {
  authenticated: boolean;
  tokenConfigured: boolean;
  maxUploadMb: number;
};

type AdminSessionContextValue = AdminSession & {
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const DEFAULT_SESSION: AdminSession = {
  authenticated: false,
  tokenConfigured: false,
  maxUploadMb: 10
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState(DEFAULT_SESSION);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setSession(await apiJson<AdminSession>("/api/admin/session"));
    } catch {
      setSession(DEFAULT_SESSION);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiJson<{ authenticated: false }>("/api/admin/session", { method: "DELETE" });
    setSession((current) => ({ ...current, authenticated: false }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    void apiJson<AdminSession>("/api/admin/session")
      .then((loadedSession) => {
        if (!cancelled) {
          setSession(loadedSession);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(DEFAULT_SESSION);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ ...session, loading, logout, refresh }),
    [loading, logout, refresh, session]
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContextValue {
  const context = useContext(AdminSessionContext);
  if (!context) {
    throw new Error("useAdminSession must be used inside AdminSessionProvider");
  }
  return context;
}
