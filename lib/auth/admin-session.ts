const SESSION_VERSION = 1;
export const ADMIN_SESSION_COOKIE = "gallery_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type SessionPayload = {
  exp: number;
  v: number;
};

const encoder = new TextEncoder();

export async function createAdminSession(
  secret: string,
  now = Date.now()
): Promise<string> {
  const payload: SessionPayload = {
    exp: Math.floor(now / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS,
    v: SESSION_VERSION
  };
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await sign(encodedPayload, secret);

  return `${encodedPayload}.${encodeBase64Url(signature)}`;
}

export async function verifyAdminSession(
  value: string,
  secret: string,
  now = Date.now()
): Promise<boolean> {
  const [encodedPayload, encodedSignature, extra] = value.split(".");
  if (!encodedPayload || !encodedSignature || extra) {
    return false;
  }

  try {
    const key = await importSigningKey(secret);
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      encoder.encode(encodedPayload)
    );
    if (!validSignature) {
      return false;
    }

    const payload = JSON.parse(
      new TextDecoder().decode(decodeBase64Url(encodedPayload))
    ) as Partial<SessionPayload>;

    return (
      payload.v === SESSION_VERSION &&
      typeof payload.exp === "number" &&
      payload.exp > Math.floor(now / 1000)
    );
  } catch {
    return false;
  }
}

export async function verifyAdminToken(candidate: string, configured: string): Promise<boolean> {
  const [candidateHash, configuredHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(candidate)),
    crypto.subtle.digest("SHA-256", encoder.encode(configured))
  ]);
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (left: ArrayBuffer, right: ArrayBuffer) => boolean;
  };

  if (subtle.timingSafeEqual) {
    return subtle.timingSafeEqual(candidateHash, configuredHash);
  }

  const left = new Uint8Array(candidateHash);
  const right = new Uint8Array(configuredHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export function readCookie(request: Request, name: string): string {
  const cookie = request.headers.get("cookie");
  const match = cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function createAdminSessionCookie(request: Request, value: string): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${ADMIN_SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Strict${secure}`;
}

export function clearAdminSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure}`;
}

async function sign(value: string, secret: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign("HMAC", await importSigningKey(secret), encoder.encode(value));
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"]
  );
}

function encodeBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
