import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { SoftLink } from "@/components/admin/soft-link"
import { ArticleTable } from "@/components/admin/article-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import {
  ADMIN_ARTICLE_PAGE_SIZE_OPTIONS,
  parseAdminArticleListParams,
} from "@/lib/admin-article-pagination"
import { getArticleRows } from "@/lib/admin-data"
import { getAdminSubtlePanelClassName } from "@/lib/admin-layout"
import { resolveLang, type AppLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type ArticlesPageProps = {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{
    page?: string
    pageSize?: string
  }>
}

function buildArticlesHref(input: {
  lang: AppLang
  page: number
  pageSize: number
}) {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  })

  return `/${input.lang}/admin/articles?${params.toString()}`
}

export default async function ArticlesPage({ params: routeParams, searchParams }: ArticlesPageProps) {
  const { lang: rawLang } = await routeParams
  const params = (await searchParams) ?? {}
  const lang = resolveLang(rawLang)
  const paginationParams = parseAdminArticleListParams(params)
  const { rows: articles, pagination } = await getArticleRows({
    page: paginationParams.page,
    pageSize: paginationParams.pageSize,
  })
  const rangeText =
    lang === "zh"
      ? `共 ${pagination.totalCount} 篇，当前 ${pagination.from}-${pagination.to}`
      : `${pagination.from}-${pagination.to} of ${pagination.totalCount} articles`
  const previousPage = Math.max(1, pagination.page - 1)
  const nextPage = Math.min(pagination.totalPages, pagination.page + 1)
  const hasPreviousPage = pagination.page > 1
  const hasNextPage = pagination.page < pagination.totalPages

  return (
    <AdminPageShell
      title={lang === "zh" ? "文章" : "Articles"}
      description={
        lang === "zh"
          ? "查看文章提取、翻译、摘要等后续处理状态。"
          : "Review article extraction, translation, summary, and downstream processing status."
      }
      currentNav="/admin/articles"
      lang={lang}
    >
      <Card>
        <CardHeader>
          <CardTitle>{lang === "zh" ? "最近文章" : "Recent articles"}</CardTitle>
          <CardDescription>
            {lang === "zh"
              ? "最近入库的文章，包含状态和中英文标题预览。"
              : "Recently ingested articles with status and bilingual title previews."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          <div className={cn("mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", getAdminSubtlePanelClassName())}>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-zinc-950 dark:text-stone-100">
                {rangeText}
              </p>
              <p className="text-xs text-muted-foreground">
                {lang === "zh"
                  ? `第 ${pagination.page} / ${pagination.totalPages} 页`
                  : `Page ${pagination.page} of ${pagination.totalPages}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {lang === "zh" ? "每页展示" : "Rows per page"}
              </span>
              <div className="flex items-center gap-1 rounded-full border border-black/8 bg-[#eef2f7] p-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] dark:border-white/8 dark:bg-[#11161d] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)]">
                {ADMIN_ARTICLE_PAGE_SIZE_OPTIONS.map((option) => (
                  <SoftLink
                    key={option}
                    href={buildArticlesHref({ lang, page: 1, pageSize: option })}
                    className={cn(
                      buttonVariants({
                        size: "xs",
                        variant:
                          option === pagination.pageSize ? "secondary" : "ghost",
                      }),
                      "min-w-8",
                    )}
                    aria-current={option === pagination.pageSize ? "page" : undefined}
                  >
                    {option}
                  </SoftLink>
                ))}
              </div>
            </div>
          </div>
          <ArticleTable articles={articles} lang={lang} />
          <div className="mt-4 flex justify-end">
            <div className="flex items-center gap-2">
              <SoftLink
                href={buildArticlesHref({
                  lang,
                  page: previousPage,
                  pageSize: pagination.pageSize,
                })}
                disabled={!hasPreviousPage}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  !hasPreviousPage && "pointer-events-none opacity-50",
                )}
              >
                <ChevronLeft className="size-3.5" />
                {lang === "zh" ? "上一页" : "Previous"}
              </SoftLink>
              <SoftLink
                href={buildArticlesHref({
                  lang,
                  page: nextPage,
                  pageSize: pagination.pageSize,
                })}
                disabled={!hasNextPage}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  !hasNextPage && "pointer-events-none opacity-50",
                )}
              >
                {lang === "zh" ? "下一页" : "Next"}
                <ChevronRight className="size-3.5" />
              </SoftLink>
            </div>
          </div>
        </CardContent>
      </Card>
    </AdminPageShell>
  )
}
