import Link from "next/link"
import { notFound } from "next/navigation"

import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { EditFeedForm } from "@/components/admin/edit-feed-form"
import { buttonVariants } from "@/components/ui/button"
import { updateFeedAction } from "@/lib/actions/feeds"
import { getFeedDetail } from "@/lib/admin-data"
import { resolveLang } from "@/lib/i18n"

export const dynamic = "force-dynamic"

type EditFeedPageProps = {
  params: Promise<{
    feedId: string
  }>
  searchParams?: Promise<{ lang?: string }>
}

export default async function EditFeedPage({ params, searchParams }: EditFeedPageProps) {
  const { feedId } = await params
  const resolvedLang = resolveLang(((await searchParams) ?? {}).lang)
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
      currentNav="/admin/feeds"
      currentPath={`/admin/feeds/${feedId}`}
      lang={resolvedLang}
    >
      <div className="flex justify-end">
        <Link href={`/admin/feeds?lang=${resolvedLang}`} className={buttonVariants({ variant: "outline" })}>
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
