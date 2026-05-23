import { cookies } from "next/headers"

import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  verifyAdminSessionToken,
} from "./admin-auth"

/**
 * Defense-in-depth auth check for admin API route handlers.
 * The middleware in proxy.ts already gates /api/admin/* paths, but this
 * provides a redundant handler-level guard in case middleware is bypassed.
 */
export async function requireAdminAuth(): Promise<
  | { authorized: true }
  | { authorized: false; response: Response }
> {
  const config = getAdminAuthConfig()

  if (!config) {
    return {
      authorized: false,
      response: Response.json(
        { ok: false, message: "Admin authentication is not configured safely." },
        { status: 503 },
      ),
    }
  }

  const cookieStore = await cookies()
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  if (!(await verifyAdminSessionToken(session, config))) {
    return {
      authorized: false,
      response: Response.json(
        { ok: false, message: "Authentication required." },
        { status: 401 },
      ),
    }
  }

  return { authorized: true }
}
