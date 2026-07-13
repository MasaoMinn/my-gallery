import {
  createAdminSession,
  verifyAdminSession,
  verifyAdminToken
} from "@/lib/auth/admin-session";

describe("admin sessions", () => {
  const secret = "test-secret-that-is-at-least-32-characters";
  const now = Date.UTC(2026, 0, 1);

  it("accepts a valid session and rejects tampering", async () => {
    const session = await createAdminSession(secret, now);

    expect(await verifyAdminSession(session, secret, now + 1_000)).toBe(true);
    expect(await verifyAdminSession(`${session}x`, secret, now + 1_000)).toBe(false);
  });

  it("rejects expired sessions and sessions signed with an old secret", async () => {
    const session = await createAdminSession(secret, now);

    expect(await verifyAdminSession(session, secret, now + 8 * 24 * 60 * 60 * 1_000)).toBe(false);
    expect(await verifyAdminSession(session, `${secret}-rotated`, now + 1_000)).toBe(false);
  });

  it("compares login tokens without direct string comparison", async () => {
    expect(await verifyAdminToken(secret, secret)).toBe(true);
    expect(await verifyAdminToken("wrong-secret", secret)).toBe(false);
  });
});
