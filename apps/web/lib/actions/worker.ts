"use server"

import { redirect } from "next/navigation"

import { pollActiveFeeds } from "worker"

import {
  buildWorkerRunErrorParams,
  buildWorkerRunRedirectParams,
} from "../worker-run"
import { resolveLang } from "../i18n"

export async function runWorkerOnceAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"))
  let redirectTarget = `/${lang}/admin`

  try {
    const pollSummary = await pollActiveFeeds()
    const params = buildWorkerRunRedirectParams({
      ...pollSummary,
      processedJobs: [],
    })

    redirectTarget = `/${lang}/admin?${params.toString()}`
  } catch (error) {
    const params = buildWorkerRunErrorParams(error)
    redirectTarget = `/${lang}/admin?${params.toString()}`
  }

  redirect(redirectTarget)
}
