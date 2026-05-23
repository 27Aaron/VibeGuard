import { cookies } from "next/headers"

import {
  ADMIN_SESSION_COOKIE,
  getAdminAuthConfig,
  verifyAdminSessionToken,
} from "./admin-auth"

export type AdminAuthResult =
  | { authorized: true }
  | { authorized: false; response: Response }

/**
 * Core auth check that can be tested without Next.js request context.
 * Returns a 401/503 response when auth fails, or { authorized: true } on success.
 */
export async function checkAdminAuthFromSession(
  sessionToken: string | undefined,
): Promise<AdminAuthResult> {
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

  if (!(await verifyAdminSessionToken(sessionToken, config))) {
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

/**
 * Defense-in-depth auth check for admin API route handlers.
 * The middleware in proxy.ts already gates /api/admin/* paths, but this
 * provides a redundant handler-level guard in case middleware is bypassed.
 */
export async function requireAdminAuth(): Promise<AdminAuthResult> {
  const cookieStore = await cookies()
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  return checkAdminAuthFromSession(session)
}
