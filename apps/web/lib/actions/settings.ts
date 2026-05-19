"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { and, eq, ne } from "drizzle-orm"
import { createOpenAIClient } from "@vibeguard/llm/client"
import {
  decryptSecret,
  encryptSecret,
} from "@vibeguard/llm/credentials"

import { getDb, llmSettings } from "@vibeguard/db"
import {
  type FormActionResult,
  errorResult,
  successResult,
} from "../action-result"
import {
  resolveSavedActiveFlag,
  resolveSettingsSuccessMessage,
  resolveStoredApiKey,
} from "../llm-settings"
import {
  buildModelAvailabilityMessage,
  normalizeProviderErrorMessage,
} from "../provider-models"
import { normalizeUserFacingError } from "../errors"
import { resolveLang } from "../i18n"

function buildSettingsRedirect(
  message: string,
  status: "success" | "error",
  profile?: string,
  lang: "zh" | "en" = "zh",
) {
  const params = new URLSearchParams({
    status,
    message,
    lang,
  })

  if (profile) {
    params.set("profile", profile)
  }

  return `/admin/settings?${params.toString()}`
}

export async function saveLlmSettingsAction(
  _previousState: FormActionResult,
  formData: FormData,
) {
  try {
    const lang = resolveLang(String(formData.get("lang") ?? "zh"))
    const formKind = String(formData.get("formKind") ?? "provider").trim()
    const id = String(formData.get("id") ?? "").trim()
    const name = String(formData.get("name") ?? "default-openai").trim()
    const baseUrl = String(formData.get("baseUrl") ?? "").trim()
    const apiKey = String(formData.get("apiKey") ?? "").trim()
    const model = String(formData.get("model") ?? "").trim()
    const translateTitlePrompt = String(
      formData.get("translateTitlePrompt") ?? "",
    ).trim()
    const translateContentPrompt = String(
      formData.get("translateContentPrompt") ?? "",
    ).trim()
    const summaryPromptEn = String(formData.get("summaryPromptEn") ?? "").trim()
    const summaryPromptZh = String(formData.get("summaryPromptZh") ?? "").trim()
    const tagPrompt = String(formData.get("tagPrompt") ?? "").trim()
    const relevancePrompt = String(formData.get("relevancePrompt") ?? "").trim()
    const requestedIsActive = formData.get("isActive") === "on"

    if (
      !name ||
      !baseUrl ||
      !model ||
      !translateTitlePrompt ||
      !translateContentPrompt ||
      !summaryPromptEn ||
      !summaryPromptZh ||
      !tagPrompt ||
      !relevancePrompt
    ) {
      return errorResult(
        lang === "zh"
          ? "配置名称、Base URL、默认模型和提示词都必须填写。"
          : "Profile name, base URL, default model, and prompts are all required.",
      )
    }

    const db = getDb()
    const existingRow = id
      ? await db.query.llmSettings.findFirst({
          where: eq(llmSettings.id, id),
        })
      : undefined
    const existingActive = await db.query.llmSettings.findFirst({
      where: eq(llmSettings.isActive, true),
    })
    const resolvedApiKey = resolveStoredApiKey({
      apiKey,
      existingApiKeyEncrypted: existingRow?.apiKeyEncrypted,
    })
    const isActive = resolveSavedActiveFlag({
      requestedIsActive,
      currentId: id,
      activeRowId: existingActive?.id,
    })
    const payload = {
      name,
      baseUrl,
      apiKeyEncrypted:
        resolvedApiKey.apiKeyToEncrypt === null
          ? existingRow!.apiKeyEncrypted
          : encryptSecret(resolvedApiKey.apiKeyToEncrypt),
      model,
      translateTitlePrompt,
      translateContentPrompt,
      summaryPromptEn,
      summaryPromptZh,
      tagPrompt,
      relevancePrompt,
      isActive,
    }

    await db.transaction(async (tx) => {
      if (isActive) {
        await tx
          .update(llmSettings)
          .set({ isActive: false })
          .where(
            id
              ? and(eq(llmSettings.isActive, true), ne(llmSettings.id, id))
              : eq(llmSettings.isActive, true),
          )
      }

      if (id) {
        await tx.update(llmSettings).set(payload).where(eq(llmSettings.id, id))
        return
      }

      await tx.insert(llmSettings).values(payload)
    })

    revalidatePath("/admin/settings")

    const successMessage = resolveSettingsSuccessMessage(formKind)
    return successResult(
      lang === "zh"
        ? successMessage
        : formKind === "pipeline"
          ? "Processing prompts saved."
          : "Model service profile saved.",
    )
  } catch (error) {
    const lang = resolveLang(String(formData.get("lang") ?? "zh"))
    return errorResult(
      normalizeUserFacingError(error, lang) ||
        (lang === "zh" ? "保存模型服务配置失败。" : "Failed to save the model profile."),
    )
  }
}

export async function activateLlmSettingsAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const profileId = String(formData.get("id") ?? "").trim()

  if (!profileId) {
    redirect(buildSettingsRedirect(lang === "zh" ? "缺少配置 ID。" : "Missing profile ID.", "error", undefined, lang))
  }

  const db = getDb()
  const row = await db.query.llmSettings.findFirst({
    where: eq(llmSettings.id, profileId),
  })

  if (!row) {
    redirect(buildSettingsRedirect(lang === "zh" ? "未找到该配置。" : "Profile not found.", "error", undefined, lang))
  }

  await db.transaction(async (tx) => {
    await tx.update(llmSettings).set({ isActive: false })
    await tx
      .update(llmSettings)
      .set({ isActive: true })
      .where(eq(llmSettings.id, row.id))
  })

  revalidatePath("/admin/settings")

  redirect(
    buildSettingsRedirect(
      lang === "zh" ? `${row.name} 已设为当前生效配置。` : `${row.name} is now the active profile.`,
      "success",
      row.id,
      lang,
    ),
  )
}

export async function testLlmSettingsAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const profileId = String(formData.get("id") ?? "").trim()

  if (!profileId) {
    redirect(buildSettingsRedirect(lang === "zh" ? "请先保存配置，再测试连接。" : "Save the profile before testing the connection.", "error", undefined, lang))
  }

  const db = getDb()
  const row = await db.query.llmSettings.findFirst({
    where: eq(llmSettings.id, profileId),
  })

  if (!row) {
    redirect(buildSettingsRedirect(lang === "zh" ? "未找到该配置。" : "Profile not found.", "error", undefined, lang))
  }

  const apiKey = decryptSecret(row.apiKeyEncrypted)

  if (!apiKey) {
    redirect(
      buildSettingsRedirect(
        "保存的 API Key 无法解密，请重新保存这套模型服务配置后再测试。",
        "error",
        row.id,
        lang,
      ),
    )
  }

  let status: "success" | "error" = "success"
  let message = ""

  try {
    const client = createOpenAIClient({
      baseUrl: row.baseUrl,
      apiKey,
    })
    const models = await client.models.list()
    const modelFound = models.data.some((model) => model.id === row.model)
    message = buildModelAvailabilityMessage({
      profileName: row.name,
      model: row.model,
      modelFound,
      lang,
    })
  } catch (error) {
    status = "error"
    message = normalizeProviderErrorMessage({
      error,
      baseUrl: row.baseUrl,
      action: "testConnection",
      lang,
    })
  }

  redirect(buildSettingsRedirect(message, status, row.id, lang))
}
