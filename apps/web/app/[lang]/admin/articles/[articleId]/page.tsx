import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  ExternalLink,
  FileText,
  Languages,
  Link2,
  RefreshCw,
  ShieldOff,
  Tags,
} from "lucide-react";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import {
  MarkdownRenderer,
  MarkdownSummary,
} from "@/components/content/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SearchToast } from "@/components/ui/search-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { reprocessArticleAction } from "@/lib/actions/articles";
import { getArticleDetail } from "@/lib/admin-data";
import { getAdminSubtlePanelClassName } from "@/lib/admin-layout";
import { pickArticleLocale } from "@/lib/article-content";
import { buildArticleRegenerationOptions } from "@/lib/article-regeneration-options";
import { getInteractiveChipClassName } from "@/lib/interactive-chip";
import { resolveLang } from "@/lib/i18n";
import { formatDateTimeInShanghai } from "@/lib/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function getRelevanceFilterReason(rawMeta: unknown): string | null {
  if (!rawMeta || typeof rawMeta !== "object") return null;
  const filter = (rawMeta as Record<string, unknown>).relevanceFilter;
  if (!filter || typeof filter !== "object") return null;
  const reason = (filter as Record<string, unknown>).reason;
  return typeof reason === "string" && reason ? reason : null;
}

type ArticleDetailPageProps = {
  params: Promise<{ lang: string; articleId: string }>;
  searchParams: Promise<{ status?: string; message?: string }>;
};

function statusMeta(status: string, lang: "zh" | "en") {
  if (status === "ready") {
    return {
      label: lang === "zh" ? "成功" : "Ready",
      className:
        "border-emerald-900/18 bg-[#dfe9e2] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100",
    };
  }

  if (status === "processing") {
    return {
      label: lang === "zh" ? "处理中" : "Processing",
      className:
        "border-blue-900/14 bg-[#e4ebf4] text-blue-950 dark:border-blue-200/14 dark:bg-[#111824] dark:text-blue-100",
    };
  }

  if (status === "failed") {
    return {
      label: lang === "zh" ? "失败" : "Failed",
      className:
        "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/35 dark:bg-destructive/15",
    };
  }

  if (status === "filtered") {
    return {
      label: lang === "zh" ? "已过滤" : "Filtered",
      className:
        "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
    };
  }

  return {
    label: lang === "zh" ? "待处理" : "Pending",
    className:
      "border-black/8 bg-[#eef2f7] text-zinc-700 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-200",
  };
}

function StatusBadge({ status, lang }: { status: string; lang: "zh" | "en" }) {
  const meta = statusMeta(status, lang);

  return (
    <Badge variant="outline" className={cn("h-6 px-2.5", meta.className)}>
      {meta.label}
    </Badge>
  );
}

function getRegenerationIcon(target: string) {
  if (target === "tags") {
    return Tags;
  }

  if (target === "fetch-source") {
    return RefreshCw;
  }

  if (target === "extract-content") {
    return FileText;
  }

  if (target === "classify-relevance") {
    return RefreshCw;
  }

  if (target === "skip-relevance") {
    return ShieldOff;
  }

  if (target.includes("summary")) {
    return FileText;
  }

  if (target.includes("zh")) {
    return Languages;
  }

  return RefreshCw;
}

export default async function ArticleDetailPage({
  params,
  searchParams,
}: ArticleDetailPageProps) {
  const { lang, articleId } = await params;
  const { status, message } = await searchParams;
  const resolvedLang = resolveLang(lang);
  const article = await getArticleDetail(articleId);

  if (!article) {
    notFound();
  }

  const localized = pickArticleLocale(article, resolvedLang);
  const regenerationOptions = buildArticleRegenerationOptions(
    {
      url: article.url,
      titleEn: article.titleEn,
      contentMdEn: article.contentMdEn,
      status: article.status,
    },
    resolvedLang,
  );
  const publishedAt = formatDateTimeInShanghai(article.publishedAt, {
    lang: resolvedLang,
  });
  const fetchedAt = formatDateTimeInShanghai(article.fetchedAt, {
    lang: resolvedLang,
  });
  const updatedAt = formatDateTimeInShanghai(article.updatedAt, {
    lang: resolvedLang,
  });
  const localeLabel =
    localized.locale === "zh"
      ? resolvedLang === "zh"
        ? "中文视图"
        : "Chinese view"
      : resolvedLang === "zh"
        ? "英文视图"
        : "English view";

  return (
    <AdminPageShell
      title={resolvedLang === "zh" ? "文章详情" : "Article details"}
      description={
        resolvedLang === "zh"
          ? "查看已保存的双语内容和当前处理结果。"
          : "Review the saved bilingual content and the current processing outcome."
      }
      lang={resolvedLang}
    >
      <SearchToast status={status} message={message} />

      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
          getAdminSubtlePanelClassName(),
        )}
      >
        <Link
          href={`/${lang}/admin/articles`}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "w-fit rounded-full border-black/8 bg-[#eef2f7] text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-[#e7ecf4] hover:text-zinc-950 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white",
          )}
        >
          <ArrowLeft className="size-3.5" />
          {resolvedLang === "zh" ? "返回文章列表" : "Back to articles"}
        </Link>
        <div className="flex w-fit items-center gap-1 rounded-full border border-black/8 bg-[#eef2f7] p-0.75 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] dark:border-white/8 dark:bg-[#11161d] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)]">
          <Link
            href={`/zh/admin/articles/${article.id}`}
            className={getInteractiveChipClassName(localized.locale === "zh")}
          >
            {resolvedLang === "zh" ? "中文" : "Chinese"}
          </Link>
          <Link
            href={`/en/admin/articles/${article.id}`}
            className={getInteractiveChipClassName(localized.locale === "en")}
          >
            {resolvedLang === "zh" ? "英文" : "English"}
          </Link>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={article.status} lang={resolvedLang} />
                <Badge
                  variant="outline"
                  className="h-6 border-black/8 bg-[#eef2f7] px-2.5 text-zinc-700 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-200"
                >
                  {localeLabel}
                </Badge>
                <Badge
                  variant="outline"
                  className="h-6 border-black/8 bg-[#eef2f7] px-2.5 text-zinc-700 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-200"
                >
                  {article.sourceName}
                </Badge>
              </div>
              {article.status === "filtered" &&
                getRelevanceFilterReason(article.rawMeta) && (
                  <div className="rounded-[1.15rem] border border-orange-200/60 bg-orange-50/80 px-4 py-3 dark:border-orange-700/40 dark:bg-orange-950/20">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-400">
                      {resolvedLang === "zh" ? "过滤原因" : "Filter reason"}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-orange-800 dark:text-orange-200">
                      {getRelevanceFilterReason(article.rawMeta)}
                    </p>
                  </div>
                )}
              <CardTitle className="max-w-5xl text-2xl leading-tight md:text-3xl">
                {localized.title}
              </CardTitle>
              <CardDescription>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-black/6 bg-white/62 px-3 py-2 text-xs font-medium text-zinc-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-colors hover:border-emerald-900/18 hover:text-emerald-800 dark:border-white/10 dark:bg-white/4.5 dark:text-stone-300 dark:shadow-none dark:hover:border-emerald-200/20 dark:hover:text-emerald-300"
                >
                  <ExternalLink className="size-3.5 shrink-0" />
                  <span className="truncate">{article.url}</span>
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 px-5 pb-5 sm:grid-cols-3">
              <div className="rounded-[1.15rem] border border-black/5 bg-white/58 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4 dark:shadow-none">
                <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-stone-500">
                  <CalendarClock className="size-3.5" />
                  {resolvedLang === "zh" ? "发布时间" : "Published"}
                </div>
                <p className="mt-2 text-sm font-medium text-zinc-950 dark:text-stone-100">
                  {publishedAt}
                </p>
              </div>
              <div className="rounded-[1.15rem] border border-black/5 bg-white/58 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4 dark:shadow-none">
                <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-stone-500">
                  <Clock3 className="size-3.5" />
                  {resolvedLang === "zh" ? "抓取时间" : "Fetched"}
                </div>
                <p className="mt-2 text-sm font-medium text-zinc-950 dark:text-stone-100">
                  {fetchedAt}
                </p>
              </div>
              <div className="rounded-[1.15rem] border border-black/5 bg-white/58 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4 dark:shadow-none">
                <div className="flex items-center gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-stone-500">
                  <RefreshCw className="size-3.5" />
                  {resolvedLang === "zh" ? "更新时间" : "Updated"}
                </div>
                <p className="mt-2 text-sm font-medium text-zinc-950 dark:text-stone-100">
                  {updatedAt}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-emerald-800 dark:text-emerald-300" />
                {resolvedLang === "zh" ? "摘要" : "Summary"}
              </CardTitle>
              <CardDescription>
                {resolvedLang === "zh"
                  ? "用于快速判断这篇内容是否需要继续跟进。"
                  : "A quick read on whether this item deserves follow-up."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="rounded-[1.25rem] border border-black/5 bg-white/62 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4 dark:shadow-none">
                <MarkdownSummary
                  content={
                    localized.summary ||
                    (resolvedLang === "zh"
                      ? "摘要暂未生成。"
                      : "Summary not generated yet.")
                  }
                  sourceUrl={article.url}
                  variant="admin"
                  lang={resolvedLang}
                  className="[&_p]:text-sm [&_p]:text-zinc-600 dark:[&_p]:text-stone-300"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-emerald-800 dark:text-emerald-300" />
                Markdown
              </CardTitle>
              <CardDescription>
                {resolvedLang === "zh"
                  ? "Worker 提取并保存的正文内容。"
                  : "Body content extracted and saved by the worker."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="rounded-[1.25rem] border border-black/5 bg-[#fcfcfa]/75 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] md:p-6 dark:border-white/10 dark:bg-[#0c1218]/72 dark:shadow-none">
                <MarkdownRenderer
                  content={
                    localized.content ||
                    (resolvedLang === "zh"
                      ? "正文暂未提取。"
                      : "Body extraction has not completed yet.")
                  }
                  sourceUrl={article.url}
                  variant="admin"
                  lang={resolvedLang}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-32 lg:self-start">
          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="size-4 text-emerald-800 dark:text-emerald-300" />
                {resolvedLang === "zh" ? "重新处理" : "Regenerate"}
              </CardTitle>
              <CardDescription>
                {resolvedLang === "zh"
                  ? "按字段重跑，减少不必要的全链路处理。"
                  : "Run only the piece that needs a refresh."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 px-4 pb-4">
              {regenerationOptions
                .filter((opt) => opt.target !== "skip-relevance")
                .map((option) => {
                  const Icon = getRegenerationIcon(option.target);
                  const skipOption =
                    option.target === "classify-relevance"
                      ? regenerationOptions.find(
                          (o) => o.target === "skip-relevance",
                        )
                      : null;

                  return (
                    <div
                      key={option.target}
                      className="rounded-[1.15rem] border border-black/5 bg-white/58 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4 dark:shadow-none"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-black/6 bg-[#f7fbf8] text-emerald-800 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#18241e] dark:text-emerald-300 dark:shadow-none">
                          <Icon className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <form action={reprocessArticleAction}>
                              <input
                                type="hidden"
                                name="id"
                                value={article.id}
                              />
                              <input
                                type="hidden"
                                name="lang"
                                value={resolvedLang}
                              />
                              <input
                                type="hidden"
                                name="target"
                                value={option.target}
                              />
                              <button
                                type="submit"
                                disabled={option.disabled}
                                className={cn(
                                  buttonVariants({
                                    size: "sm",
                                    variant: "outline",
                                  }),
                                  "h-8 rounded-full border-black/8 bg-[#eef2f7] px-3 text-[0.78rem] font-semibold text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-[#e7ecf4] hover:text-zinc-950 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white",
                                )}
                              >
                                {option.label}
                              </button>
                            </form>
                            {skipOption && (
                              <form action={reprocessArticleAction}>
                                <input
                                  type="hidden"
                                  name="id"
                                  value={article.id}
                                />
                                <input
                                  type="hidden"
                                  name="lang"
                                  value={resolvedLang}
                                />
                                <input
                                  type="hidden"
                                  name="target"
                                  value="skip-relevance"
                                />
                                <button
                                  type="submit"
                                  disabled={skipOption.disabled}
                                  className={cn(
                                    buttonVariants({
                                      size: "sm",
                                      variant: "outline",
                                    }),
                                    "h-8 rounded-full border-orange-200/60 bg-orange-50/80 px-3 text-[0.78rem] font-semibold text-orange-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-orange-100 hover:text-orange-900 dark:border-orange-700/40 dark:bg-orange-950/30 dark:text-orange-300 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-orange-900/40 dark:hover:text-orange-200",
                                  )}
                                >
                                  {skipOption.label}
                                </button>
                              </form>
                            )}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-stone-400">
                            {option.disabledReason ?? option.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="size-4 text-emerald-800 dark:text-emerald-300" />
                {resolvedLang === "zh" ? "标签" : "Tags"}
              </CardTitle>
              <CardDescription>
                {resolvedLang === "zh"
                  ? "用于首页筛选和后续 API 查询。"
                  : "Used by public filters and future API queries."}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {article.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <Badge
                      key={`${article.id}-${tag}`}
                      variant="outline"
                      className="h-7 border-black/8 bg-[#eef2f7] px-3 text-zinc-700 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-200"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="rounded-[1.15rem] border border-dashed border-black/10 bg-white/48 px-4 py-4 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-stone-400">
                  {resolvedLang === "zh"
                    ? "当前还没有生成标签，可以点击上方重新生成标签。"
                    : "No tags have been generated yet. Use the regenerate tags action above."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card size="sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-4 text-emerald-800 dark:text-emerald-300" />
                {resolvedLang === "zh" ? "来源信息" : "Source info"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4 pb-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500 dark:text-stone-400">
                  {resolvedLang === "zh" ? "来源" : "Source"}
                </span>
                <span className="min-w-0 truncate font-medium text-zinc-950 dark:text-stone-100">
                  {article.sourceName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500 dark:text-stone-400">
                  {resolvedLang === "zh" ? "生态" : "Ecosystem"}
                </span>
                <span className="font-medium text-zinc-950 dark:text-stone-100">
                  {article.ecosystem}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500 dark:text-stone-400">
                  {resolvedLang === "zh" ? "风险类型" : "Risk"}
                </span>
                <span className="font-medium text-zinc-950 dark:text-stone-100">
                  {article.riskCategory}
                </span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>
    </AdminPageShell>
  );
}
