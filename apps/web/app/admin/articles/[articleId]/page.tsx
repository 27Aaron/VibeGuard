import Link from "next/link"
import { notFound } from "next/navigation"

import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { MarkdownRenderer, MarkdownSummary } from "@/components/content/markdown-renderer"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { reprocessArticleAction } from "@/lib/actions/articles"
import { getArticleDetail } from "@/lib/admin-data"
import { pickArticleLocale } from "@/lib/article-content"
import { buildArticleRegenerationOptions } from "@/lib/article-regeneration-options"
import { resolveLang } from "@/lib/i18n"
import { formatDateTimeInShanghai } from "@/lib/time"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type ArticleDetailPageProps = {
  params: Promise<{ articleId: string }>
  searchParams: Promise<{ lang?: string; status?: string; message?: string }>
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "ready"
      ? "secondary"
      : status === "processing"
        ? "outline"
        : status === "failed"
          ? "destructive"
          : "default"

  const label =
    status === "ready"
      ? "已完成"
      : status === "processing"
        ? "处理中"
        : status === "failed"
          ? "失败"
          : "待处理"

  return <Badge variant={variant}>{label}</Badge>
}

export default async function ArticleDetailPage({
  params,
  searchParams,
}: ArticleDetailPageProps) {
  const { articleId } = await params
  const { lang, status, message } = await searchParams
  const resolvedLang = resolveLang(lang)
  const article = await getArticleDetail(articleId)

  if (!article) {
    notFound()
  }

  const localized = pickArticleLocale(article, resolvedLang)
  const regenerationOptions = buildArticleRegenerationOptions(
    {
      titleEn: article.titleEn,
      contentMdEn: article.contentMdEn,
      contentMdZh: article.contentMdZh,
    },
    resolvedLang,
  )

  return (
    <AdminPageShell
      title={resolvedLang === "zh" ? "文章详情" : "Article details"}
      description={
        resolvedLang === "zh"
          ? "查看已保存的双语内容和当前处理结果。"
          : "Review the saved bilingual content and the current processing outcome."
      }
      currentNav="/admin/articles"
      currentPath={`/admin/articles/${articleId}`}
      lang={resolvedLang}
    >
      {message ? (
        <div
          className={cn(
            "rounded-lg border px-4 py-3 text-sm",
            status === "success"
              ? "border-border bg-muted/40 text-foreground"
              : "border-destructive/40 bg-destructive/5 text-destructive",
          )}
        >
          {message}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/admin/articles?lang=${resolvedLang}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          {resolvedLang === "zh" ? "返回文章列表" : "Back to articles"}
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/articles/${article.id}?lang=zh`}
            className={`text-sm ${localized.locale === "zh" ? "font-medium" : "text-muted-foreground"}`}
          >
            {resolvedLang === "zh" ? "中文" : "Chinese"}
          </Link>
          <Link
            href={`/admin/articles/${article.id}?lang=en`}
            className={`text-sm ${localized.locale === "en" ? "font-medium" : "text-muted-foreground"}`}
          >
            {resolvedLang === "zh" ? "英文" : "English"}
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={article.status} />
            <CardDescription>{article.sourceName}</CardDescription>
            <CardDescription>{formatDateTimeInShanghai(article.publishedAt)}</CardDescription>
          </div>
          <CardTitle>{localized.title}</CardTitle>
          <CardDescription>
            <a href={article.url} target="_blank" rel="noreferrer" className="hover:underline">
              {article.url}
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-medium">
                {resolvedLang === "zh" ? "重新处理操作" : "Regeneration actions"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {resolvedLang === "zh"
                  ? "可以按字段单独重生成，避免每次都全量跑完整链路。标签会使用英文原文重新提取。"
                  : "Regenerate only the part you need instead of re-running the whole pipeline every time. Tags use the original English body."}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {regenerationOptions.map((option) => (
                <form key={option.target} action={reprocessArticleAction} className="flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-3">
                  <input type="hidden" name="id" value={article.id} />
                  <input type="hidden" name="lang" value={resolvedLang} />
                  <input type="hidden" name="target" value={option.target} />
                  <button
                    type="submit"
                    disabled={option.disabled}
                    className={buttonVariants({
                      size: "sm",
                      variant: option.target === "full" ? "default" : "outline",
                    })}
                  >
                    {option.label}
                  </button>
                  <p className="min-h-5 text-xs text-muted-foreground">
                    {option.disabledReason ??
                      (resolvedLang === "zh" ? "当前条件已满足，可直接执行。" : "Ready to run with the current article content.")}
                  </p>
                </form>
              ))}
            </div>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{resolvedLang === "zh" ? "标签" : "Tags"}</h2>
            {article.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <Badge key={`${article.id}-${tag}`} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {resolvedLang === "zh"
                  ? "当前还没有生成标签，可以点击上方重新生成标签。"
                  : "No tags have been generated yet. Use the regenerate tags action above."}
              </p>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">{resolvedLang === "zh" ? "摘要" : "Summary"}</h2>
            <MarkdownSummary
              content={localized.summary || (resolvedLang === "zh" ? "摘要暂未生成。" : "Summary not generated yet.")}
              sourceUrl={article.url}
              variant="admin"
              lang={resolvedLang}
              className="[&_p]:text-sm [&_p]:text-muted-foreground"
            />
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Markdown</h2>
            <div className="rounded-xl border border-border bg-muted/20 p-4 md:p-6">
              <MarkdownRenderer
                content={localized.content || (resolvedLang === "zh" ? "正文暂未提取。" : "Body extraction has not completed yet.")}
                sourceUrl={article.url}
                variant="admin"
                lang={resolvedLang}
              />
            </div>
          </section>
        </CardContent>
      </Card>
    </AdminPageShell>
  )
}
