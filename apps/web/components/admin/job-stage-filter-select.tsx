"use client";

import { useRouter } from "next/navigation";

import type { JobStageFilter, JobStatusFilter } from "@/components/admin/types";
import { ADMIN_JOB_STAGE_FILTERS } from "@/lib/admin-job-pagination";
import { getAdminFilterSelectClassName } from "@/lib/admin-layout";
import type { AppLang } from "@/lib/i18n";
import { stageLabel } from "@/lib/pipeline-stages";

export function JobStageFilterSelect({
  lang,
  status,
  stage,
  pageSize,
}: {
  lang: AppLang;
  status: JobStatusFilter;
  stage: JobStageFilter;
  pageSize: number;
}) {
  const router = useRouter();

  return (
    <select
      aria-label={lang === "zh" ? "当前阶段" : "Current stage"}
      className={getAdminFilterSelectClassName()}
      value={stage}
      onChange={(event) => {
        const raw = event.target.value;
        const nextStage = ADMIN_JOB_STAGE_FILTERS.includes(
          raw as JobStageFilter,
        )
          ? (raw as JobStageFilter)
          : ("all" as JobStageFilter);
        const params = new URLSearchParams({
          lang,
          page: "1",
          pageSize: String(pageSize),
        });

        if (status !== "all") {
          params.set("status", status);
        }

        if (nextStage !== "all") {
          params.set("stage", nextStage);
        }

        router.push(`/${lang}/admin/jobs?${params.toString()}`);
      }}
    >
      {ADMIN_JOB_STAGE_FILTERS.map((option) => (
        <option key={option} value={option}>
          {stageLabel(option, lang)}
        </option>
      ))}
    </select>
  );
}
