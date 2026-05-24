import Link from "next/link";

import { AdminSelectAllCheckbox } from "@/components/admin/admin-select-all-checkbox";
import { Badge } from "@/components/ui/badge";
import type { ArticleRow } from "@/components/admin/types";
import { getAdminTableSurfaceClassName } from "@/lib/admin-layout";
import type { AppLang } from "@/lib/i18n";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusLabel(status: ArticleRow["status"], lang: AppLang) {
  switch (status) {
    case "ready":
      return lang === "zh" ? "成功" : "Ready";
    case "processing":
      return lang === "zh" ? "处理中" : "Processing";
    case "failed":
      return lang === "zh" ? "失败" : "Failed";
    case "filtered":
      return lang === "zh" ? "已过滤" : "Filtered";
    default:
      console.warn(`Unknown article status: ${status}`);
      return lang === "zh" ? "待处理" : "Pending";
  }
}

export function ArticleTable({
  articles,
  lang,
}: {
  articles: ArticleRow[];
  lang: AppLang;
}) {
  if (articles.length === 0) {
    return (
      <div className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/58 px-6 py-10 text-center dark:border-white/10 dark:bg-white/[0.04]">
        <p className="text-sm font-medium text-zinc-950 dark:text-stone-100">
          {lang === "zh" ? "还没有文章" : "No articles yet"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "zh"
            ? "先添加来源并执行一轮处理，文章会自动出现在这里。"
            : "Add a source and run one processing cycle. Articles will appear here automatically."}
        </p>
      </div>
    );
  }

  return (
    <div className={getAdminTableSurfaceClassName()}>
      <Table>
        <TableHeader className="bg-white/56 dark:bg-white/[0.035]">
          <TableRow>
            <TableHead className="w-14 px-4">
              <AdminSelectAllCheckbox
                formId="selected-articles-form"
                inputName="ids"
                label={
                  lang === "zh"
                    ? "全选当前页文章"
                    : "Select all articles on this page"
                }
              />
            </TableHead>
            <TableHead className="px-4">
              {lang === "zh" ? "标题" : "Title"}
            </TableHead>
            <TableHead className="px-4 text-center">
              {lang === "zh" ? "来源" : "Source"}
            </TableHead>
            <TableHead className="px-4 text-center">
              {lang === "zh" ? "状态" : "Status"}
            </TableHead>
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
              <TableCell className="px-4 py-3 align-middle">
                <label className="flex cursor-pointer items-center justify-center">
                  <input
                    aria-label={
                      lang === "zh"
                        ? `选择 ${article.title}`
                        : `Select ${article.title}`
                    }
                    form="selected-articles-form"
                    name="ids"
                    type="checkbox"
                    value={article.id}
                  />
                </label>
              </TableCell>
              <TableCell className="max-w-[420px] px-4 py-3 align-middle font-medium">
                <div className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={`/${lang}/admin/articles/${article.id}`}
                    className="truncate hover:underline"
                  >
                    {article.title}
                  </Link>
                  {article.summary ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {article.summary}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-center align-middle">
                {article.source}
              </TableCell>
              <TableCell className="px-4 py-3 text-center align-middle">
                <Badge
                  variant={
                    article.status === "ready"
                      ? "secondary"
                      : article.status === "processing"
                        ? "outline"
                        : article.status === "failed"
                          ? "destructive"
                          : article.status === "filtered"
                            ? "outline"
                            : "default"
                  }
                  className={
                    article.status === "filtered"
                      ? "border-orange-300 text-orange-600 dark:border-orange-700 dark:text-orange-400"
                      : undefined
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
  );
}
