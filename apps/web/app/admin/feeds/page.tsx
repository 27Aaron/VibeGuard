import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { CreateFeedForm } from "@/components/admin/create-feed-form"
import { FeedTable } from "@/components/admin/feed-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createFeedAction } from "@/lib/actions/feeds"
import { getFeedRows } from "@/lib/admin-data"
import { resolveLang } from "@/lib/i18n"

export const dynamic = "force-dynamic"

type FeedsPageProps = {
  searchParams?: Promise<{
    lang?: string
    status?: string
    message?: string
  }>
}

export default async function FeedsPage({ searchParams }: FeedsPageProps) {
  const params = (await searchParams) ?? {}
  const lang = resolveLang(params.lang)
  const feeds = await getFeedRows(lang)
  const showBanner = params.status === "success" || params.status === "error"

  return (
    <AdminPageShell
      title={lang === "zh" ? "来源" : "Sources"}
      description={
        lang === "zh"
          ? "管理内容来源的可用状态、抓取频率和即时抓取入口。"
          : "Manage source availability, polling cadence, and instant fetch actions."
      }
      currentNav="/admin/feeds"
      lang={lang}
    >
      {showBanner ? (
        <div
          className={`rounded-[1.15rem] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:shadow-none ${
            params.status === "error"
              ? "border-destructive/40 bg-destructive/5 text-destructive dark:bg-destructive/10"
              : "border-emerald-900/18 bg-[#f7fbf8] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100"
          }`}
        >
          {params.message}
        </div>
      ) : null}
      <CreateFeedForm action={createFeedAction} lang={lang} />
      <Card>
        <CardHeader>
          <CardTitle>{lang === "zh" ? "已配置来源" : "Configured sources"}</CardTitle>
          <CardDescription>
            {lang === "zh"
              ? "当前已保存、可供抓取 Worker 使用的 RSS / Atom 来源。"
              : "Saved RSS / Atom sources currently available to the worker."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          <FeedTable feeds={feeds} lang={lang} />
        </CardContent>
      </Card>
    </AdminPageShell>
  )
}
