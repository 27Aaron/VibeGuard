"use client";

import { ExternalLink } from "lucide-react";

import { MarkdownSummary } from "@/components/content/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import type { AppLang } from "@/lib/i18n";
import { getUiText } from "@/lib/i18n";
import {
  formatAffectedRanges,
  getSecurityFindingLatestUpdatedAt,
  type SecurityFinding,
} from "@/lib/security-workbench";
import { cn } from "@/lib/utils";
import { ExpandableMarkdownBlock } from "@/components/security/package-check-expandable-content";
import {
  affectedRangeBadgeClassName,
  advisoryRelationItems,
  cvssLevelBadgeClassName,
  cvssLevelFromScore,
  cvssLevelLabel,
  findingMetricBadges,
  findingReferenceItems,
  fixedVersionBadgeClassName,
  formatFindingTime,
  primaryCveEnrichment,
  referenceLabel,
  relationKindLabel,
  toneBadgeVariant,
  toneLabel,
  withdrawnLabel,
} from "@/components/security/package-check-utils";
import { getAdminSubtlePanelClassName } from "@/lib/admin-layout";

type FindingCardProps = {
  finding: SecurityFinding;
  index: number;
  lang: AppLang;
};

export function FindingCard({ finding, index, lang }: FindingCardProps) {
  const copy = getUiText(lang);

  const formattedRanges = formatAffectedRanges(
    finding.affectedPackage.ranges,
  );
  const latestUpdatedAt =
    getSecurityFindingLatestUpdatedAt(finding);
  const publishedAt = formatFindingTime(
    finding.advisory.publishedAt,
    lang,
  );
  const updatedAt = formatFindingTime(latestUpdatedAt, lang);
  const findingMetaParts = [
    finding.advisory.id,
    publishedAt
      ? `${lang === "zh" ? "发布" : "Published"} ${publishedAt}`
      : null,
    updatedAt
      ? `${lang === "zh" ? "更新" : "Updated"} ${updatedAt}`
      : null,
  ].filter((part): part is string => Boolean(part));
  const metricBadges = findingMetricBadges(finding, lang);
  const tone = toneLabel(finding, lang);
  const cvssLevel = cvssLevelFromScore(
    primaryCveEnrichment(finding)?.bestCvssScore,
  );
  const affectedRangeLabels =
    formattedRanges.length > 0
      ? formattedRanges
      : finding.affectedPackage.affectedVersions;
  const hasRemediationInfo =
    affectedRangeLabels.length > 0 ||
    finding.affectedPackage.fixedVersions.length > 0;
  const referenceItems = findingReferenceItems(finding);
  const withdrawnInfo = withdrawnLabel(finding, lang);
  const relationItems = advisoryRelationItems(finding);

  return (
    <article className={cn("space-y-4", getAdminSubtlePanelClassName())}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-stone-500">
            {findingMetaParts.join(" · ")}
          </p>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {cvssLevel ? (
              <Badge
                variant="outline"
                className={cn(
                  "h-7 px-2.5",
                  cvssLevelBadgeClassName(cvssLevel),
                )}
              >
                {cvssLevelLabel(cvssLevel, lang)}
              </Badge>
            ) : null}
            <Badge
              variant={toneBadgeVariant(finding)}
              className="h-7 px-2.5"
            >
              {tone}
            </Badge>
          </div>
        </div>
        <MarkdownSummary
          content={finding.advisory.summary || finding.matchSummary}
          variant="public"
          lang={lang}
          className="text-sm font-medium leading-6 text-zinc-950 dark:text-stone-50 [&_p]:!my-0 [&_p]:text-inherit [&_ul]:text-inherit [&_ol]:text-inherit"
        />
        {metricBadges.length > 0 ? (
          <div className="flex flex-nowrap gap-2 overflow-x-auto text-xs">
            {metricBadges.map((badge) => (
              <Badge
                key={badge.key}
                variant={badge.variant}
                className={cn(
                  "h-7 shrink-0 whitespace-nowrap px-2.5",
                  badge.className,
                )}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {withdrawnInfo ? (
        <div className="rounded-2xl border border-zinc-900/8 bg-zinc-50/70 px-4 py-3 text-xs leading-5 text-zinc-600 dark:border-white/10 dark:bg-white/[0.035] dark:text-stone-300">
          {withdrawnInfo}
        </div>
      ) : null}

      {hasRemediationInfo ? (
        <div className="grid gap-4 md:grid-cols-2">
          {affectedRangeLabels.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                {copy.publicCheckAffectedRangesLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {affectedRangeLabels.map(
                  (rangeLabel, rangeIndex) => (
                    <Badge
                      key={`${rangeLabel}-${rangeIndex}`}
                      variant="outline"
                      className={affectedRangeBadgeClassName()}
                    >
                      {rangeLabel}
                    </Badge>
                  ),
                )}
              </div>
            </div>
          ) : null}

          {finding.affectedPackage.fixedVersions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                {lang === "zh" ? "修复版本" : "Fixed versions"}
              </p>
              <div className="flex flex-wrap gap-2">
                {finding.affectedPackage.fixedVersions.map(
                  (fixedVersion: string) => (
                    <Badge
                      key={fixedVersion}
                      variant="secondary"
                      className={fixedVersionBadgeClassName()}
                    >
                      {fixedVersion}
                    </Badge>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {relationItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
            {lang === "zh" ? "关联记录" : "Related records"}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {relationItems.map((item) => (
              <Badge
                key={`${item.kind}-${item.id}`}
                variant="outline"
                className="h-6 px-2.5"
              >
                {relationKindLabel(item.kind, lang)} · {item.id}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {finding.advisory.details ? (
        <ExpandableMarkdownBlock
          label={copy.publicCheckDetailsLabel}
          content={finding.advisory.details}
          lang={lang}
          expandLabel={copy.publicCheckDetailsToggle}
          collapseLabel={copy.publicCheckDetailsCollapse}
        />
      ) : null}

      {referenceItems.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
            {lang === "zh" ? "参考链接" : "References"} ·{" "}
            {referenceItems.length}
          </p>
          <ul className="flex flex-wrap gap-2 text-xs">
            {referenceItems.map(
              (
                reference: SecurityFinding["advisory"]["references"][number],
                referenceIndex: number,
              ) => (
                <li key={`${reference.url}-${referenceIndex}`}>
                  <a
                    href={reference.url}
                    target="_blank"
                    rel="noreferrer"
                    title={reference.url}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-black/6 px-2.5 text-zinc-600 transition-colors hover:border-black/12 hover:text-zinc-950 dark:border-white/10 dark:text-stone-300 dark:hover:border-white/20 dark:hover:text-stone-50"
                  >
                    {referenceLabel(reference, lang)}
                    <ExternalLink className="size-3" />
                  </a>
                </li>
              ),
            )}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
