import {
  clearAdminSessionCookie,
  createAdminSession,
  createAdminSessionCookie,
  verifyAdminToken
} from "@/lib/auth/admin-session";
import { getBindings } from "@/lib/cloudflare";
import { configuredAdminToken, isAdminRequest, requireRequestOrigin } from "@/lib/http/admin";
import { handleRouteError, ok } from "@/lib/http/responses";
import { adminLoginSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const env = getBindings();
    return noStore(
      ok({
        authenticated: await isAdminRequest(request, env),
        tokenConfigured: Boolean(env.GALLERY_ADMIN_TOKEN?.trim()),
        maxUploadMb: Number(env.GALLERY_MAX_UPLOAD_MB ?? "95")
      })
    );
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireRequestOrigin(request);
    const env = getBindings();
    const configuredToken = configuredAdminToken(env);
    const input = adminLoginSchema.parse(await request.json());
    if (!(await verifyAdminToken(input.token, configuredToken))) {
      return noStore(
        Response.json(
          { error: { code: "unauthorized", message: "管理员密钥无效" } },
          { status: 401 }
        )
      );
    }

    const response = ok({ authenticated: true });
    response.headers.set(
      "set-cookie",
      createAdminSessionCookie(request, await createAdminSession(configuredToken))
    );
    return noStore(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    requireRequestOrigin(request);
    const response = ok({ authenticated: false });
    response.headers.set("set-cookie", clearAdminSessionCookie(request));
    return noStore(response);
  } catch (error) {
    return handleRouteError(error);
  }
}

function noStore(response: Response): Response {
  response.headers.set("cache-control", "no-store");
  return response;
}
