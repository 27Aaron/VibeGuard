import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { getDb, llmSettings } from "@vibeguard/db"
import { createOpenAIClient } from "@vibeguard/llm/client"
import { decryptSecret } from "@vibeguard/llm/credentials"

import { requireAdminAuth } from "@/lib/admin-api-auth"
import { resolveLang } from "@/lib/i18n"
import { normalizeProviderErrorMessage } from "@/lib/provider-models"

/**
 * Whitelist of allowed provider hostnames derived from PROVIDER_PRESETS.
 * Only these domains (plus localhost/127.0.0.1 in development) may be used
 * as baseUrl targets to prevent SSRF attacks.
 */
const ALLOWED_PROVIDER_HOSTNAMES: ReadonlySet<string> = new Set([
  "api.deepseek.com",
  "api.minimax.io",
  "api.minimaxi.com",
  "api.moonshot.cn",
  "api.openai.com",
  "api.siliconflow.cn",
  "api.z.ai",
  "open.bigmodel.cn",
  "openrouter.ai",
])

const LOCALHOST_HOSTNAMES: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "::1",  "[::1]",
])

function isAllowedProviderUrl(baseUrl: string): boolean {
  let parsed: URL

  try {
    parsed = new URL(baseUrl)
  } catch {
    return false
  }

  const hostname = parsed.hostname.toLowerCase()

  if (ALLOWED_PROVIDER_HOSTNAMES.has(hostname)) {
    return true
  }

  // Allow localhost only in development
  if (
    LOCALHOST_HOSTNAMES.has(hostname) &&
    process.env.NODE_ENV === "development"
  ) {
    return true
  }

  return false
}

export async function POST(request: Request) {
  const auth = await requireAdminAuth()
  if (!auth.authorized) return auth.response

  let resolvedBaseUrl = ""
  let resolvedLang = resolveLang("zh")

  try {
    const body = (await request.json()) as {
      profileId?: string
      baseUrl?: string
      apiKey?: string
      lang?: string
    }

    const profileId = String(body.profileId ?? "").trim()
    const baseUrl = String(body.baseUrl ?? "").trim()
    resolvedBaseUrl = baseUrl
    const inputApiKey = String(body.apiKey ?? "").trim()
    const lang = resolveLang(body.lang)
    resolvedLang = lang

    if (!baseUrl) {
      return NextResponse.json(
        {
          ok: false,
          message:
            lang === "zh"
              ? "请先填写模型服务地址。"
              : "Please enter the model service base URL first.",
        },
        { status: 400 },
      )
    }

    if (!isAllowedProviderUrl(baseUrl)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            lang === "zh"
              ? "不被允许的模型服务地址，请使用已知服务商或检查 Base URL。"
              : "Base URL is not allowed. Please use a known provider or check the URL.",
        },
        { status: 400 },
      )
    }

    let apiKey = inputApiKey

    if (!apiKey && profileId) {
      const db = getDb()
      const row = await db.query.llmSettings.findFirst({
        where: eq(llmSettings.id, profileId),
      })

      if (row?.apiKeyEncrypted) {
        apiKey = decryptSecret(row.apiKeyEncrypted)
      }
    }

    if (!apiKey) {
      return NextResponse.json(
        {
          ok: false,
          message:
            lang === "zh"
              ? "请先填写 API Key，或先保存当前配置后再获取模型列表。"
              : "Enter an API key first, or save this profile before loading models.",
        },
        { status: 400 },
      )
    }

    const client = createOpenAIClient({
      baseUrl,
      apiKey,
    })
    const models = await client.models.list()

    return NextResponse.json({
      ok: true,
      models: models.data
        .map((model) => model.id)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: normalizeProviderErrorMessage({
          error,
          baseUrl: resolvedBaseUrl,
          action: "listModels",
          lang: resolvedLang,
        }),
      },
      { status: 500 },
    )
  }
}
