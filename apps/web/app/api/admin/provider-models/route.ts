import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { getDb, llmSettings } from "@vibeguard/db"
import { createOpenAIClient } from "@vibeguard/llm/client"
import { decryptSecret } from "@vibeguard/llm/credentials"
import { resolveLang } from "@/lib/i18n"
import { normalizeProviderErrorMessage } from "@/lib/provider-models"

export async function POST(request: Request) {
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
