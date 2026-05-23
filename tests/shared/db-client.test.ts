import fs from "node:fs"

import { describe, expect, it } from "vitest"

const clientSource = fs.readFileSync("packages/db/src/client.ts", "utf8")

describe("CFG-01 — Pool timeout, idle timeout, and SSL config", () => {
  // -------------------------------------------------------------------------
  // 1. Pool is created with timeout values
  // -------------------------------------------------------------------------
  describe("pool configuration", () => {
    it("imports normalizeInt from @vibeguard/shared", () => {
      expect(clientSource).toMatch(
        /import\s*\{[^}]*normalizeInt[^}]*\}\s*from\s*["']@vibeguard\/shared["']/,
      )
    })

    it("sets connectionTimeoutMillis using normalizeInt with default 5000", () => {
      expect(clientSource).toContain(
        "connectionTimeoutMillis: normalizeInt(process.env.DB_CONNECT_TIMEOUT_MS, 5_000)",
      )
    })

    it("sets idleTimeoutMillis using normalizeInt with default 30000", () => {
      expect(clientSource).toContain(
        "idleTimeoutMillis: normalizeInt(process.env.DB_IDLE_TIMEOUT_MS, 30_000)",
      )
    })

    it("sets max pool size using normalizeInt with default 10", () => {
      expect(clientSource).toContain(
        "max: normalizeInt(process.env.DB_POOL_MAX, 10)",
      )
    })
  })

  // -------------------------------------------------------------------------
  // 2. SSL is enabled when DB_SSL=true
  // -------------------------------------------------------------------------
  describe("SSL configuration", () => {
    it("enables ssl with rejectUnauthorized when DB_SSL is 'true'", () => {
      expect(clientSource).toContain(
        'ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined',
      )
    })

    it("does not unconditionally enable ssl", () => {
      // Should NOT be `ssl: true` or `ssl: { rejectUnauthorized: true }` without a condition
      const unconditionalSsl = /ssl:\s*(true|\{\s*rejectUnauthorized[^}]*\})\s*,?\s*\n/
      // Find the ssl line in the Pool constructor
      const poolBlock = clientSource.match(/new Pool\(\{[\s\S]*?\}\)/)
      expect(poolBlock).not.toBeNull()

      // Within the Pool block, ssl must be conditional
      const sslLine = poolBlock![0].match(/ssl:.*$/m)
      expect(sslLine).not.toBeNull()
      expect(sslLine![0]).toContain('DB_SSL === "true"')
    })
  })

  // -------------------------------------------------------------------------
  // 3. Defaults are sensible when env vars are not set
  // -------------------------------------------------------------------------
  describe("sensible defaults", () => {
    it("normalizeInt provides fallback so undefined env vars use safe defaults", () => {
      // Verify that every numeric pool config uses normalizeInt (not Number())
      const poolBlock = clientSource.match(/new Pool\(\{[\s\S]*?\}\)/)
      expect(poolBlock).not.toBeNull()

      const poolConfig = poolBlock![0]

      // connectionTimeoutMillis must use normalizeInt
      expect(poolConfig).toMatch(
        /connectionTimeoutMillis:\s*normalizeInt\(/,
      )
      // idleTimeoutMillis must use normalizeInt
      expect(poolConfig).toMatch(
        /idleTimeoutMillis:\s*normalizeInt\(/,
      )
      // max must use normalizeInt
      expect(poolConfig).toMatch(/max:\s*normalizeInt\(/)
    })

    it("does not use raw Number() for any pool config value", () => {
      const poolBlock = clientSource.match(/new Pool\(\{[\s\S]*?\}\)/)
      expect(poolBlock).not.toBeNull()

      // Should NOT contain Number(...) inside the Pool config
      expect(poolBlock![0]).not.toMatch(/Number\(/)
    })
  })
})
