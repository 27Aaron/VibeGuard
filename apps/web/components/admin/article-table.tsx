import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { ArticleRow } from "@/components/admin/types"
import { getAdminTableSurfaceClassName } from "@/lib/admin-layout"
import type { AppLang } from "@/lib/i18n"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function statusLabel(status: ArticleRow["status"], lang: AppLang) {
  switch (status) {
    case "ready":
      return lang === "zh" ? "已完成" : "Ready"
    case "processing":
      return lang === "zh" ? "处理中" : "Processing"
    case "failed":
      return lang === "zh" ? "失败" : "Failed"
    default:
      return lang === "zh" ? "待处理" : "Pending"
  }
}

export function ArticleTable({ articles, lang }: { articles: ArticleRow[]; lang: AppLang }) {
  return (
    <div className={getAdminTableSurfaceClassName()}>
      <Table>
        <TableHeader className="bg-white/56 dark:bg-white/[0.035]">
          <TableRow>
            <TableHead className="px-4">{lang === "zh" ? "标题" : "Title"}</TableHead>
            <TableHead className="px-4 text-center">{lang === "zh" ? "来源" : "Source"}</TableHead>
            <TableHead className="px-4 text-center">{lang === "zh" ? "状态" : "Status"}</TableHead>
            <TableHead className="px-4 text-center">
              {lang === "zh" ? "发布时间" : "Published at"}
            </TableHead>
            <TableHead className="px-4 text-center">
              {lang === "zh" ? "更新时间" : "Updated at"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((article) => (
            <TableRow key={article.id}>
              <TableCell className="max-w-[420px] px-4 py-3 align-middle font-medium">
                <div className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={`/admin/articles/${article.id}?lang=${lang}`}
                    className="truncate hover:underline"
                  >
                    {article.title}
                  </Link>
                  {article.titleZh ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {article.titleEn}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-center align-middle">{article.source}</TableCell>
              <TableCell className="px-4 py-3 text-center align-middle">
                <Badge
                  variant={
                    article.status === "ready"
                      ? "secondary"
                      : article.status === "processing"
                        ? "outline"
                        : article.status === "failed"
                          ? "destructive"
                          : "default"
                  }
                >
                  {statusLabel(article.status, lang)}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-3 text-center align-middle tabular-nums">
                {article.publishedAt}
              </TableCell>
              <TableCell className="px-4 py-3 text-center align-middle tabular-nums">
                {article.updatedAt}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
