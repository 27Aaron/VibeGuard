import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { EditFeedForm } from "@/components/admin/edit-feed-form"
import { buttonVariants } from "@/components/ui/button"
import { updateFeedAction } from "@/lib/actions/feeds"
import { getFeedDetail } from "@/lib/admin-data"
import { getAdminSubtlePanelClassName } from "@/lib/admin-layout"
import { resolveLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type EditFeedPageProps = {
  params: Promise<{
    lang: string
    feedId: string
  }>
  searchParams?: Promise<{}>
}

export default async function EditFeedPage({ params, searchParams }: EditFeedPageProps) {
  const { lang, feedId } = await params
  const resolvedLang = resolveLang(lang)
  const feed = await getFeedDetail(feedId)

  if (!feed) {
    notFound()
  }

  return (
    <AdminPageShell
      title={resolvedLang === "zh" ? "编辑来源" : "Edit source"}
      description={
        resolvedLang === "zh"
          ? "在后台内直接调整来源信息、抓取频率和启停状态。"
          : "Adjust source details, polling cadence, and enabled state directly from the admin UI."
      }
      lang={resolvedLang}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          getAdminSubtlePanelClassName(),
        )}
      >
        <Link
          href={`/${lang}/admin/feeds`}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "w-fit rounded-full border-black/8 bg-[#eef2f7] text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(15,23,42,0.06)] hover:bg-[#e7ecf4] hover:text-zinc-950 dark:border-white/8 dark:bg-[#11161d] dark:text-stone-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_1px_2px_rgba(0,0,0,0.28)] dark:hover:bg-[#151b22] dark:hover:text-white",
          )}
        >
          <ChevronLeft className="size-3.5" />
          {resolvedLang === "zh" ? "返回来源列表" : "Back to sources"}
        </Link>
      </div>
      <EditFeedForm
        action={updateFeedAction}
        lang={resolvedLang}
        initialValues={{
          id: feed.id,
          name: feed.name,
          siteUrl: feed.siteUrl,
          feedUrl: feed.feedUrl,
          feedType: feed.feedType,
          pollIntervalMinutes: feed.pollIntervalMinutes,
          enabled: feed.enabled,
        }}
      />
    </AdminPageShell>
  )
}
