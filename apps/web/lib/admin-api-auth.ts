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
 * 核心身份验证检查，可在不依赖 Next.js 请求上下文的情况下进行单元测试。
 * 验证失败时返回 401（未认证）或 503（服务不可用）响应，成功时返回 { authorized: true }。
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
 * 纵深防御式的身份验证检查，用于管理后台 API 路由处理器。
 * proxy.ts 中的中间件已经对 /api/admin/* 路径进行了拦截，
 * 但这里提供了一层冗余的处理函数级别防护，以防止中间件被绕过的情况。
 */
export async function requireAdminAuth(): Promise<AdminAuthResult> {
  const cookieStore = await cookies()
  const session = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  return checkAdminAuthFromSession(session)
}
