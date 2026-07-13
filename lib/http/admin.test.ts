import { createAdminSession, createAdminSessionCookie } from "@/lib/auth/admin-session";
import { requireAdmin } from "@/lib/http/admin";

describe("requireAdmin", () => {
  const token = "test-secret-that-is-at-least-32-characters";

  it("fails closed when the administrator token is missing", async () => {
    const request = new Request("https://gallery.example/api/albums", { method: "POST" });

    await expect(requireAdmin(request, {} as CloudflareEnv)).rejects.toMatchObject({
      status: 503,
      code: "admin_token_not_configured"
    });
  });

  it("accepts a same-origin signed session", async () => {
    const session = await createAdminSession(token);
    const cookie = createAdminSessionCookie(
      new Request("https://gallery.example/api/albums"),
      session
    ).split(";")[0];
    const request = new Request("https://gallery.example/api/albums", {
      method: "POST",
      headers: { cookie, origin: "https://gallery.example" }
    });

    await expect(requireAdmin(request, { GALLERY_ADMIN_TOKEN: token } as CloudflareEnv)).resolves.toBeUndefined();
  });

  it("rejects a cross-origin cookie-authenticated mutation", async () => {
    const session = await createAdminSession(token);
    const cookie = createAdminSessionCookie(
      new Request("https://gallery.example/api/albums"),
      session
    ).split(";")[0];
    const request = new Request("https://gallery.example/api/albums", {
      method: "POST",
      headers: { cookie, origin: "https://attacker.example" }
    });

    await expect(requireAdmin(request, { GALLERY_ADMIN_TOKEN: token } as CloudflareEnv)).rejects.toMatchObject({
      status: 403,
      code: "invalid_origin"
    });
  });

  it("accepts equivalent localhost and loopback origins during local development", async () => {
    const session = await createAdminSession(token);
    const cookie = createAdminSessionCookie(
      new Request("http://localhost:3000/api/albums"),
      session
    ).split(";")[0];
    const request = new Request("http://localhost:3000/api/albums", {
      method: "POST",
      headers: { cookie, origin: "http://127.0.0.1:3000" }
    });

    await expect(
      requireAdmin(request, { GALLERY_ADMIN_TOKEN: token } as CloudflareEnv)
    ).resolves.toBeUndefined();
  });

  it("retains bearer token access for controlled automation", async () => {
    const request = new Request("https://gallery.example/api/albums", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` }
    });

    await expect(requireAdmin(request, { GALLERY_ADMIN_TOKEN: token } as CloudflareEnv)).resolves.toBeUndefined();
  });
});
