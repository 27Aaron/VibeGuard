"use server";

import { redirect } from "next/navigation";

import { pollActiveFeeds } from "worker";

import {
  buildWorkerRunErrorParams,
  buildWorkerRunRedirectParams,
} from "../worker-run";
import { resolveLang } from "../i18n";

let workerRunInProgress = false;

export async function runWorkerOnceAction(formData: FormData) {
  const lang = resolveLang(String(formData.get("lang") ?? "zh"));
  let redirectTarget = `/${lang}/admin`;

  if (workerRunInProgress) {
    const params = new URLSearchParams({
      error:
        lang === "zh"
          ? "Worker 正在运行中，请稍后再试。"
          : "Worker is already running. Please try again later.",
    });
    redirectTarget = `/${lang}/admin?${params.toString()}`;
    redirect(redirectTarget);
  }

  workerRunInProgress = true;

  try {
    const pollSummary = await pollActiveFeeds();
    const params = buildWorkerRunRedirectParams({
      ...pollSummary,
      processedJobs: [],
    });

    redirectTarget = `/${lang}/admin?${params.toString()}`;
  } catch (error) {
    const params = buildWorkerRunErrorParams(error);
    redirectTarget = `/${lang}/admin?${params.toString()}`;
  } finally {
    workerRunInProgress = false;
  }

  redirect(redirectTarget);
}
