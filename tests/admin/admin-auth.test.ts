import { afterEach, describe, expect, it } from "vitest"

import { proxy } from "../../apps/web/proxy"
import {
  clearLoginFailures,
  createAdminSessionToken,
  recordFailedLogin,
  sanitizeAdminReturnPath,
  verifyAdminSessionToken,
  isLoginRateLimited,
} from "../../apps/web/lib/admin-auth"

type ProxyRequest = Parameters<typeof proxy>[0]
type TestNextUrl = URL & { clone: () => TestNextUrl }

const originalAdminPassword = process.env.ADMIN_PASSWORD
const originalVibeguardSecret = process.env.VIBEGUARD_SECRET
const originalContentFoundationSecret = process.env.CONTENT_FOUNDATION_SECRET

function createNextUrl(pathname: string): TestNextUrl {
  const url = new URL(`http://127.0.0.1:3000${pathname}`) as TestNextUrl
  url.clone = () => createNextUrl(`${url.pathname}${url.search}`)
  return url
}

function parseCookies(cookieHeader: string) {
  return new Map(
    cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean)
      .map((cookie) => {
        const [name, ...valueParts] = cookie.split("=")
        return [name, valueParts.join("=")]
      }),
  )
}

function createProxyRequest(pathname: string, cookie = ""): ProxyRequest {
  const cookies = parseCookies(cookie)

  return {
    headers: new Headers({
      cookie,
    }),
    cookies: {
      get(name: string) {
        const value = cookies.get(name)
        return value ? { name, value } : undefined
      },
    },
    nextUrl: createNextUrl(pathname),
    url: `http://127.0.0.1:3000${pathname}`,
  } as ProxyRequest
}

afterEach(() => {
  if (originalAdminPassword === undefined) {
    delete process.env.ADMIN_PASSWORD
  } else {
    process.env.ADMIN_PASSWORD = originalAdminPassword
  }

  if (originalVibeguardSecret === undefined) {
    delete process.env.VIBEGUARD_SECRET
  } else {
    process.env.VIBEGUARD_SECRET = originalVibeguardSecret
  }

  if (originalContentFoundationSecret === undefined) {
    delete process.env.CONTENT_FOUNDATION_SECRET
  } else {
    process.env.CONTENT_FOUNDATION_SECRET = originalContentFoundationSecret
  }

  clearLoginFailures("127.0.0.1")
})

describe("admin auth proxy", () => {
  it("rejects unauthenticated admin API requests", async () => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple"
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef"

    const response = await proxy(createProxyRequest("/api/admin/worker-status"))

    expect(response.status).toBe(401)
  })

  it("fails closed when admin auth is not configured safely", async () => {
    delete process.env.ADMIN_PASSWORD
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef"

    const response = await proxy(createProxyRequest("/zh/admin"))

    expect(response.headers.get("location")).toContain(
      "/zh/admin/login?error=config",
    )
  })

  it("allows admin pages with a signed session cookie", async () => {
    process.env.ADMIN_PASSWORD = "correct horse battery staple"
    process.env.VIBEGUARD_SECRET = "0123456789abcdef0123456789abcdef"
    const token = await createAdminSessionToken({
      password: process.env.ADMIN_PASSWORD,
      secret: process.env.VIBEGUARD_SECRET,
    })

    const response = await proxy(
      createProxyRequest("/zh/admin", `admin_session=${token}`),
    )

    expect(response.headers.get("x-middleware-next")).toBe("1")
  })
})

describe("admin auth helpers", () => {
  it("only redirects back to localized admin paths after login", () => {
    expect(sanitizeAdminReturnPath("/zh/admin/jobs?page=1", "zh")).toBe(
      "/zh/admin/jobs?page=1",
    )
    expect(sanitizeAdminReturnPath("https://evil.example/phish", "zh")).toBe(
      "/zh/admin",
    )
    expect(sanitizeAdminReturnPath("//evil.example/phish", "en")).toBe(
      "/en/admin",
    )
    expect(sanitizeAdminReturnPath("/en/admin", "zh")).toBe("/zh/admin")
    expect(sanitizeAdminReturnPath("/zh/admin/login", "zh")).toBe("/zh/admin")
  })

  it("signs session tokens and rejects tampering or password changes", async () => {
    const token = await createAdminSessionToken({
      password: "correct horse battery staple",
      secret: "0123456789abcdef0123456789abcdef",
      issuedAt: 1_800_000_000_000,
    })

    await expect(
      verifyAdminSessionToken(token, {
        password: "correct horse battery staple",
        secret: "0123456789abcdef0123456789abcdef",
        now: 1_800_000_001_000,
      }),
    ).resolves.toBe(true)
    await expect(
      verifyAdminSessionToken(`${token}tampered`, {
        password: "correct horse battery staple",
        secret: "0123456789abcdef0123456789abcdef",
        now: 1_800_000_001_000,
      }),
    ).resolves.toBe(false)
    await expect(
      verifyAdminSessionToken(token, {
        password: "new password",
        secret: "0123456789abcdef0123456789abcdef",
        now: 1_800_000_001_000,
      }),
    ).resolves.toBe(false)
  })

  it("rate limits repeated failed login attempts", () => {
    const key = "127.0.0.1"

    for (let index = 0; index < 5; index += 1) {
      recordFailedLogin(key, 1_800_000_000_000 + index)
    }

    expect(isLoginRateLimited(key, 1_800_000_010_000)).toBe(true)
    expect(isLoginRateLimited(key, 1_800_000_400_001)).toBe(false)
  })
})
