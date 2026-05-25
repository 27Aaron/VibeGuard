"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
} from "lucide-react";

import {
  MarkdownSummary,
} from "@/components/content/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminSubtlePanelClassName } from "@/lib/admin-layout";
import type { AppLang } from "@/lib/i18n";
import { getUiText } from "@/lib/i18n";
import type { SecurityOverviewTotals } from "@/lib/security-overview";
import {
  buildSecurityCheckRequestBody,
  buildSecurityResultSummary,
  formatAffectedRanges,
  getSecurityFindingLatestUpdatedAt,
  buildSecurityWorkbenchResultState,
  type SecurityFinding,
} from "@/lib/security-workbench";
import {
  clearPersistedSecurityWorkbenchState,
  loadPersistedSecurityWorkbenchState,
  savePersistedSecurityWorkbenchState,
  type PersistedSecurityWorkbenchState,
} from "@/lib/security-workbench-state";
import { formatDateTimeInShanghai } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ExpandableMarkdownBlock } from "@/components/security/package-check-expandable-content";
import {
  affectedRangeBadgeClassName,
  advisoryRelationItems,
  cvssLevelBadgeClassName,
  cvssLevelFromScore,
  cvssLevelLabel,
  ecosystemLabel,
  findingMetricBadges,
  findingReferenceItems,
  fixedVersionBadgeClassName,
  formatFindingTime,
  parseCheckResponse,
  primaryCveEnrichment,
  referenceLabel,
  relationKindLabel,
  toneBadgeVariant,
  toneLabel,
  withdrawnLabel,
} from "@/components/security/package-check-utils";

type PackageCheckWorkbenchProps = {
  lang: AppLang;
  initialOverviewTotals: SecurityOverviewTotals;
  lastSyncTime: string | null;
};

type PackageCheckWorkbenchResult = ReturnType<
  typeof buildSecurityWorkbenchResultState
>;

type SubmittedQuery = NonNullable<
  PersistedSecurityWorkbenchState["submittedQuery"]
>;

const findingsPerPage = 3;

export function PackageCheckWorkbench({
  lang,
  initialOverviewTotals,
  lastSyncTime,
}: PackageCheckWorkbenchProps) {
  const copy = getUiText(lang);
  const [ecosystem, setEcosystem] = useState<SecurityPackageEcosystem>("npm");
  const [packageName, setPackageName] = useState("");
  const [version, setVersion] = useState("");
  const [selectOpen, setSelectOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PackageCheckWorkbenchResult | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [submittedQuery, setSubmittedQuery] = useState<SubmittedQuery | null>(
    null,
  );
  const [storageReady, setStorageReady] = useState(false);
  const selectRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = loadPersistedSecurityWorkbenchState();
    if (saved) {
      setEcosystem(saved.ecosystem);
      setPackageName(saved.packageName);
      setVersion(saved.version);
      if (saved.result) setResult(saved.result);
      if (saved.submittedQuery) setSubmittedQuery(saved.submittedQuery);
    }
    setStorageReady(true);
  }, []);

  const persistState = useCallback(
    (
      eco: SecurityPackageEcosystem,
      name: string,
      ver: string,
      query: SubmittedQuery | null,
      res: PackageCheckWorkbenchResult | null,
    ) => {
      savePersistedSecurityWorkbenchState({
        ecosystem: eco,
        packageName: name,
        version: ver,
        submittedQuery: query,
        result: res,
      });
    },
    [],
  );

  useEffect(() => {
    if (!storageReady || pending) {
      return;
    }

    if (!packageName.trim() && !version.trim() && !submittedQuery && !result) {
      clearPersistedSecurityWorkbenchState();
      return;
    }

    persistState(ecosystem, packageName, version, submittedQuery, result);
  }, [
    ecosystem,
    packageName,
    pending,
    persistState,
    result,
    storageReady,
    submittedQuery,
    version,
  ]);

  useEffect(() => {
    if (!selectOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!selectRef.current?.contains(event.target as Node)) {
        setSelectOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectOpen]);

  const matchedCount = result?.findings.length ?? 0;
  const pageCount = result
    ? Math.max(1, Math.ceil(result.findings.length / findingsPerPage))
    : 1;
  const pageStart = (currentPage - 1) * findingsPerPage;
  const pageEnd = pageStart + findingsPerPage;
  const pagedFindings = result ? result.findings.slice(pageStart, pageEnd) : [];
  const resultSummary =
    result && !result.empty
      ? buildSecurityResultSummary(result.findings)
      : null;
  const overviewBadge = copy.publicCheckOverviewBadge(
    ecosystemLabel(ecosystem),
    initialOverviewTotals[ecosystem] ?? 0,
  );
  const summaryRiskCount = resultSummary
    ? submittedQuery?.version
      ? copy.publicCheckHitCountBadge(resultSummary.affectedCount)
      : copy.publicCheckMatchCountBadge(matchedCount)
    : null;
  const latestUpdatedAt = resultSummary?.latestUpdatedAt
    ? formatDateTimeInShanghai(resultSummary.latestUpdatedAt, { lang })
    : null;
  const summaryLineParts = [
    copy.publicCheckResultLabel,
    latestUpdatedAt
      ? `${lang === "zh" ? "最近漏洞更新" : "Latest vulnerability update"} ${latestUpdatedAt}`
      : null,
  ].filter((part): part is string => Boolean(part));
  const summaryPackageLabel = `${packageName.trim()}${submittedQuery?.version ? `@${submittedQuery.version}` : ""}`;

  function resetSearchState(nextEcosystem: SecurityPackageEcosystem) {
    setEcosystem(nextEcosystem);
    setPackageName("");
    setVersion("");
    setError(null);
    setResult(null);
    setCurrentPage(1);
    setSubmittedQuery(null);
    clearPersistedSecurityWorkbenchState();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPending(true);
    setError(null);
    setResult(null);
    setCurrentPage(1);

    try {
      const normalizedVersion = version.trim() || null;
      const payload = await parseCheckResponse(
        await fetch("/api/security/check/packages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            buildSecurityCheckRequestBody({
              ecosystem,
              name: packageName,
              version,
            }),
          ),
        }),
      );

      const resultState = buildSecurityWorkbenchResultState(payload);
      const query = { version: normalizedVersion };
      setResult(resultState);
      setSubmittedQuery(query);
      persistState(ecosystem, packageName, version, query, resultState);
    } catch (submitError) {
      setResult(null);
      setSubmittedQuery(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : lang === "zh"
            ? "查询失败，请稍后再试。"
            : "The check failed. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[1.35rem] border border-black/5 bg-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-white/4.5 dark:shadow-none">
        <form
          action="#"
          className="flex flex-col gap-3"
          onSubmit={handleSubmit}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="px-1 text-sm leading-6 text-zinc-600 dark:text-stone-300">
              {copy.publicCheckSearchHint}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-stone-400">
              <Badge variant="outline" className="h-7 px-3">
                {overviewBadge}
              </Badge>
              {lastSyncTime ? (
                <Badge variant="outline" className="h-7 px-3">
                  {lang === "zh" ? "数据更新于" : "Data updated"}{" "}
                  {formatDateTimeInShanghai(lastSyncTime, { lang })}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div ref={selectRef} className="relative lg:w-[208px]">
              <label htmlFor="security-ecosystem-trigger" className="sr-only">
                {lang === "zh" ? "生态" : "Ecosystem"}
              </label>
              <button
                id="security-ecosystem-trigger"
                type="button"
                aria-haspopup="listbox"
                aria-expanded={selectOpen}
                className="flex h-11 w-full items-center justify-between rounded-full border border-black/6 bg-[#fcfcfa] px-4 text-sm text-zinc-950 outline-none transition-colors hover:border-black/10 focus-visible:border-emerald-700/30 focus-visible:ring-2 focus-visible:ring-emerald-700/10 dark:border-white/10 dark:bg-white/5.5 dark:text-stone-100 dark:hover:border-white/15 dark:focus-visible:border-emerald-200/30 dark:focus-visible:ring-emerald-200/10"
                onClick={() => setSelectOpen((current) => !current)}
                disabled={pending}
              >
                <span>{ecosystemLabel(ecosystem)}</span>
                <ChevronDown className="size-4 text-zinc-500 dark:text-stone-400" />
              </button>
              {selectOpen ? (
                <div
                  role="listbox"
                  className="absolute left-0 top-[calc(100%+0.45rem)] z-20 flex w-full flex-col gap-1.5 rounded-[1.1rem] border border-black/8 bg-[#fcfcfa] p-1.5 shadow-[0_14px_34px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-[#1b2028]"
                >
                  {SECURITY_PACKAGE_ECOSYSTEM_VALUES.map((option) => {
                    const active = option === ecosystem;

                    return (
                      <button
                        key={option}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "flex w-full items-center rounded-[0.85rem] px-3 py-2 text-left text-sm transition-colors",
                          active
                            ? "bg-black/[0.045] text-zinc-950 dark:bg-white/[0.08] dark:text-stone-50"
                            : "text-zinc-700 hover:bg-black/[0.03] dark:text-stone-200 dark:hover:bg-white/[0.05]",
                        )}
                        onClick={() => {
                          resetSearchState(option);
                          setSelectOpen(false);
                        }}
                      >
                        {ecosystemLabel(option)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <label htmlFor="security-package-name" className="sr-only">
              {copy.publicCheckPackageName}
            </label>
            <Input
              id="security-package-name"
              type="search"
              value={packageName}
              onChange={(event) => {
                setPackageName(event.target.value);
                persistState(
                  ecosystem,
                  event.target.value,
                  version,
                  submittedQuery,
                  result,
                );
              }}
              placeholder={
                ecosystem === "npm" ? "@scope/package" : "package-name"
              }
              className="h-11 min-w-0 flex-1 rounded-full border-black/6 bg-[#fcfcfa] px-4 text-sm text-zinc-950 placeholder:text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus-visible:border-emerald-700/30 dark:border-white/10 dark:bg-white/5.5 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus-visible:border-emerald-200/30 dark:shadow-none"
              disabled={pending}
              required
            />
            <label htmlFor="security-package-version" className="sr-only">
              {copy.publicCheckVersion}
            </label>
            <Input
              id="security-package-version"
              value={version}
              onChange={(event) => {
                setVersion(event.target.value);
                persistState(
                  ecosystem,
                  packageName,
                  event.target.value,
                  submittedQuery,
                  result,
                );
              }}
              placeholder="1.0.0"
              className="h-11 rounded-full border-black/6 bg-[#fcfcfa] px-4 text-sm text-zinc-950 placeholder:text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus-visible:border-emerald-700/30 lg:w-[180px] dark:border-white/10 dark:bg-white/5.5 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus-visible:border-emerald-200/30 dark:shadow-none"
              disabled={pending}
            />
            <Button
              type="submit"
              aria-label={
                pending ? copy.publicCheckSubmitting : copy.publicCheckSubmit
              }
              title={
                pending ? copy.publicCheckSubmitting : copy.publicCheckSubmit
              }
              disabled={pending || !packageName.trim()}
              className={cn(
                buttonVariants({ size: "icon", variant: "outline" }),
                "size-11 shrink-0 rounded-full border-emerald-900/12 bg-[#e9f2ec] text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-[#dcebe2] hover:text-emerald-950 dark:border-emerald-200/14 dark:bg-emerald-300/10 dark:text-emerald-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_1px_2px_rgba(0,0,0,0.24)] dark:hover:bg-emerald-300/14 dark:hover:text-emerald-50",
              )}
            >
              <Search className="size-4" />
              <span className="sr-only">
                {pending ? copy.publicCheckSubmitting : copy.publicCheckSubmit}
              </span>
            </Button>
          </div>
        </form>
      </div>

      {error ? (
        <div
          className="rounded-[1.15rem] border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:bg-destructive/10 dark:shadow-none"
          aria-live="polite"
        >
          {error}
        </div>
      ) : null}

      {resultSummary ? (
        <section className={cn("space-y-3", getAdminSubtlePanelClassName())}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-stone-500">
                {summaryLineParts.join(" · ")}
              </p>
              <p className="text-base font-medium text-zinc-950 dark:text-stone-50">
                {summaryPackageLabel} {summaryRiskCount}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="h-7 px-2.5">
                {lang === "zh" ? "按更新时间排序" : "Sorted by update time"}
              </Badge>
            </div>
          </div>
          {resultSummary.recommendedFixedVersions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-l border-emerald-600/25 pl-4 dark:border-emerald-300/25">
              <span className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                {lang === "zh" ? "建议升级" : "Upgrade to"}
              </span>
              {resultSummary.recommendedFixedVersions.map((fixedVersion) => (
                <Badge
                  key={fixedVersion}
                  variant="secondary"
                  className={fixedVersionBadgeClassName()}
                >
                  {fixedVersion}
                </Badge>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {result ? (
        result.empty ? (
          <section className={cn("space-y-2", getAdminSubtlePanelClassName())}>
            <p className="text-sm text-zinc-700 dark:text-stone-200">
              {copy.publicCheckNoFindings}
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            {pagedFindings.map((finding, index) => {
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
                <article
                  key={`${finding.advisory.id}-${finding.package.name}-${index}`}
                  className={cn("space-y-4", getAdminSubtlePanelClassName())}
                >
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
            })}
            {pageCount > 1 ? (
              <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-zinc-500 dark:text-stone-400">
                <span>
                  {copy.publicCheckPageStatus(currentPage, pageCount)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-full"
                  disabled={currentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  aria-label={copy.pagePrev}
                  title={copy.pagePrev}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-9 rounded-full"
                  disabled={currentPage === pageCount}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(pageCount, page + 1))
                  }
                  aria-label={copy.pageNext}
                  title={copy.pageNext}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            ) : null}
          </section>
        )
      ) : null}
    </div>
  );
}
