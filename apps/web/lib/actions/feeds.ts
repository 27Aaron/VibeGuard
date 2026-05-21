"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"

import { articles, getDb, feeds } from "@vibeguard/db"
import { pollFeedNow } from "worker"
import {
  type FormActionResult,
  errorResult,
  successResult,
} from "../action-result"
import { normalizeUserFacingError } from "../errors"
import { parseFeedInput } from "../feed-input"
import { resolveLang } from "../i18n"
import { revalidateLocalizedPaths } from "../revalidate"

function buildFeedRedirect(status: "success" | "error", message: string, lang: "zh" | "en") {
  const params = new URLSearchParams({
    status,
    message,
  })

  return `/${lang}/admin/feeds?${params.toString()}`
}

export async function createFeedAction(
  _previousState: FormActionResult,
  formData: FormData,
) {
  try {
    const lang = resolveLang(String(formData.get("lang") ?? "zh"))
    const payload = parseFeedInput(formData)

    const db = getDb()
    const existingFeed = await db.query.feeds.findFirst({
      where: eq(feeds.feedUrl, payload.feedUrl),
    })

    if (existingFeed) {
      return errorResult(lang === "zh" ? "已存在相同订阅地址的来源。" : "A source with the same feed URL already exists.")
    }

    await db.insert(feeds).values(payload)

    revalidateLocalizedPaths("/admin/feeds")

    return successResult(lang === "zh" ? `已创建来源：${payload.name}。` : `Source created: ${payload.name}.`)
  } catch (error) {
    const lang = resolveLang(String(formData.get("lang") ?? "zh"))
    return errorResult(
      normalizeUserFacingError(error) || (lang === "zh" ? "创建来源失败。" : "Failed to create source."),
    )
  }
}

export async function updateFeedAction(
  _previousState: FormActionResult,
  formData: FormData,
) {
  try {
    const lang = resolveLang(String(formData.get("lang") ?? "zh"))
    const feedId = String(formData.get("id") ?? "").trim()

    if (!feedId) {
      return errorResult(lang === "zh" ? "缺少来源 ID。" : "Missing source ID.")
    }

    const payload = parseFeedInput(formData)
    const db = getDb()
    const existingFeed = await db.query.feeds.findFirst({
      where: eq(feeds.id, feedId),
    })

    if (!existingFeed) {
      return errorResult(lang === "zh" ? "未找到该来源。" : "Source not found.")
    }

    const duplicateFeed = await db.query.feeds.findFirst({
      where: eq(feeds.feedUrl, payload.feedUrl),
    })

    if (duplicateFeed && duplicateFeed.id !== feedId) {
      return errorResult(lang === "zh" ? "已存在相同订阅地址的来源。" : "A source with the same feed URL already exists.")
    }

    await db.update(feeds).set(payload).where(eq(feeds.id, feedId))

    revalidateLocalizedPaths("/admin/feeds", `/admin/feeds/${feedId}`)

    return successResult(lang === "zh" ? `已更新来源：${payload.name}。` : `Source updated: ${payload.name}.`)
  } catch (error) {
    const lang = resolveLang(String(formData.get("lang") ?? "zh"))
    return errorResult(
      normalizeUserFacingError(error) || (lang === "zh" ? "更新来源失败。" : "Failed to update source."),
    )
  }
}

export async function toggleFeedAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const feedId = String(formData.get("id") ?? "").trim()

  if (!feedId) {
    redirect(buildFeedRedirect("error", lang === "zh" ? "缺少来源 ID。" : "Missing source ID.", lang))
  }

  const db = getDb()
  const existingFeed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  })

  if (!existingFeed) {
    redirect(buildFeedRedirect("error", lang === "zh" ? "未找到该来源。" : "Source not found.", lang))
  }

  const nextEnabled = !existingFeed.enabled
  await db
    .update(feeds)
    .set({ enabled: nextEnabled })
    .where(eq(feeds.id, existingFeed.id))

  revalidateLocalizedPaths("/admin/feeds")

  redirect(
    buildFeedRedirect(
      "success",
      lang === "zh"
        ? `${existingFeed.name}${nextEnabled ? " 已启用。" : " 已暂停。"}`
        : `${existingFeed.name} ${nextEnabled ? "enabled." : "paused."}`,
      lang,
    ),
  )
}

export async function deleteFeedAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const feedId = String(formData.get("id") ?? "").trim()

  if (!feedId) {
    redirect(buildFeedRedirect("error", lang === "zh" ? "缺少来源 ID。" : "Missing source ID.", lang))
  }

  const db = getDb()
  const existingFeed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  })

  if (!existingFeed) {
    redirect(buildFeedRedirect("error", lang === "zh" ? "未找到该来源。" : "Source not found.", lang))
  }

  const linkedArticle = await db.query.articles.findFirst({
    where: eq(articles.feedId, existingFeed.id),
    columns: { id: true },
  })

  if (linkedArticle) {
    redirect(
      buildFeedRedirect(
        "error",
        lang === "zh"
          ? "该来源下已有文章，删除前请先清理相关文章。"
          : "This source already has articles. Remove related articles before deleting it.",
        lang,
      ),
    )
  }

  await db.delete(feeds).where(eq(feeds.id, existingFeed.id))

  revalidateLocalizedPaths("/admin/feeds")

  redirect(
    buildFeedRedirect(
      "success",
      lang === "zh" ? `${existingFeed.name} 已删除。` : `${existingFeed.name} deleted.`,
      lang,
    ),
  )
}

export async function fetchFeedNowAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  const feedId = String(formData.get("id") ?? "").trim()

  if (!feedId) {
    redirect(buildFeedRedirect("error", lang === "zh" ? "缺少来源 ID。" : "Missing source ID.", lang))
  }

  const db = getDb()
  const existingFeed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  })

  if (!existingFeed) {
    redirect(buildFeedRedirect("error", lang === "zh" ? "未找到该来源。" : "Source not found.", lang))
  }

  let redirectTarget = buildFeedRedirect(
    "error",
    lang === "zh" ? "立即抓取失败。" : "Immediate fetch failed.",
    lang,
  )

  try {
    const pollSummary = await pollFeedNow(feedId, { db })

    revalidateLocalizedPaths(
      "/admin",
      "/admin/feeds",
      "/admin/articles",
      "/admin/jobs",
      "/",
    )

    redirectTarget = buildFeedRedirect(
      "success",
      lang === "zh"
        ? `${existingFeed.name} 已立即抓取，发现 ${pollSummary.processedItemCount} 条 feed item，新任务已交给常驻 Worker。`
        : `${existingFeed.name} fetched immediately. ${pollSummary.processedItemCount} feed items discovered; new jobs were handed to the persistent worker.`,
      lang,
    )
  } catch (error) {
    redirectTarget = buildFeedRedirect(
      "error",
      normalizeUserFacingError(error) || (lang === "zh" ? "立即抓取失败。" : "Immediate fetch failed."),
      lang,
    )
  }

  redirect(redirectTarget)
}
