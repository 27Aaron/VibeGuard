import Link from "next/link"
import {
  ExternalLink,
  Orbit,
  PauseCircle,
  PencilLine,
  PlayCircle,
  PlusCircle,
  RefreshCw,
  Trash2,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { FeedRow } from "@/components/admin/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  deleteFeedAction,
  fetchFeedNowAction,
  toggleFeedAction,
} from "@/lib/actions/feeds"
import { getAdminTableSurfaceClassName } from "@/lib/admin-layout"
import type { AppLang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function FeedTable({ feeds, lang }: { feeds: FeedRow[]; lang: AppLang }) {
  const copy =
    lang === "zh"
      ? {
          emptyStateTitle: "当前还没有配置任何来源",
          emptyStateBody: "先添加一个 RSS 或 Atom 来源，再回来这里查看抓取状态和即时操作。",
          addSource: "去添加来源",
        }
      : {
          emptyStateTitle: "No sources are configured yet",
          emptyStateBody:
            "Add an RSS or Atom source first, then come back here to review sync state and quick actions.",
          addSource: "Add a source",
        }

  if (feeds.length === 0) {
    return (
      <div className="rounded-[1.45rem] border border-dashed border-black/10 bg-white/58 px-6 py-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
        <div className="flex flex-col items-start gap-4">
          <span className="rounded-full border border-black/6 bg-[#f7fbf8] p-2 text-emerald-800 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#18241e] dark:text-emerald-300 dark:shadow-none">
            <Orbit className="size-4" />
          </span>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-zinc-950 dark:text-stone-100">
              {copy.emptyStateTitle}
            </p>
            <p className="max-w-xl text-sm text-muted-foreground">{copy.emptyStateBody}</p>
          </div>
          <Link
            href={`/admin/feeds?lang=${lang}`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "inline-flex items-center gap-2")}
          >
            <PlusCircle className="size-4" />
            {copy.addSource}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={getAdminTableSurfaceClassName()}>
      <Table>
        <TableHeader className="bg-white/56 dark:bg-white/[0.035]">
          <TableRow>
            <TableHead className="px-4">{lang === "zh" ? "来源" : "Source"}</TableHead>
            <TableHead className="px-4 text-center">{lang === "zh" ? "类型" : "Type"}</TableHead>
            <TableHead className="px-4 text-center">
              {lang === "zh" ? "抓取频率" : "Cadence"}
            </TableHead>
            <TableHead className="px-4 text-center">{lang === "zh" ? "状态" : "Status"}</TableHead>
            <TableHead className="px-4 text-center">
              {lang === "zh" ? "最近同步" : "Last synced"}
            </TableHead>
            <TableHead className="px-4 text-center">{lang === "zh" ? "操作" : "Actions"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {feeds.map((feed) => (
            <TableRow key={feed.id}>
              <TableCell className="px-4 py-3 align-middle font-medium">
                <div className="flex flex-col gap-1">
                  <span>{feed.name}</span>
                  <a
                    href={feed.siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    {feed.siteUrl}
                  </a>
                </div>
              </TableCell>
              <TableCell className="px-4 py-3 text-center align-middle uppercase text-muted-foreground">
                {feed.feedType}
              </TableCell>
              <TableCell className="px-4 py-3 text-center align-middle">{feed.cadence}</TableCell>
              <TableCell className="px-4 py-3 text-center align-middle">
                <Badge variant={feed.status === "enabled" ? "secondary" : "outline"}>
                  {feed.status === "enabled"
                    ? lang === "zh"
                      ? "启用中"
                      : "Enabled"
                    : lang === "zh"
                      ? "已暂停"
                      : "Paused"}
                </Badge>
              </TableCell>
              <TableCell className="px-4 py-3 text-center align-middle tabular-nums">{feed.lastSyncedAt}</TableCell>
              <TableCell className="px-4 py-3 text-center align-middle">
                <div className="inline-flex flex-wrap items-center gap-2 rounded-[1rem] border border-black/5 bg-white/68 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
                  <Link
                    href={`/admin/feeds/${feed.id}?lang=${lang}`}
                    className={cn(
                      buttonVariants({ size: "sm", variant: "outline" }),
                      "inline-flex items-center gap-1.5",
                    )}
                  >
                    <PencilLine className="size-3.5" />
                    {lang === "zh" ? "编辑" : "Edit"}
                  </Link>
                  <form action={fetchFeedNowAction}>
                    <input type="hidden" name="id" value={feed.id} />
                    <input type="hidden" name="lang" value={lang} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      disabled={!feed.enabled}
                      className="inline-flex items-center gap-1.5"
                    >
                      <RefreshCw className="size-3.5" />
                      {lang === "zh" ? "立即抓取" : "Fetch now"}
                    </Button>
                  </form>
                  <form action={toggleFeedAction}>
                    <input type="hidden" name="id" value={feed.id} />
                    <input type="hidden" name="lang" value={lang} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="inline-flex items-center gap-1.5"
                    >
                      {feed.enabled ? (
                        <PauseCircle className="size-3.5" />
                      ) : (
                        <PlayCircle className="size-3.5" />
                      )}
                      {feed.enabled
                        ? lang === "zh"
                          ? "暂停"
                          : "Pause"
                        : lang === "zh"
                          ? "启用"
                          : "Enable"}
                    </Button>
                  </form>
                  <form action={deleteFeedAction}>
                    <input type="hidden" name="id" value={feed.id} />
                    <input type="hidden" name="lang" value={lang} />
                    <Button
                      type="submit"
                      size="sm"
                      variant="destructive"
                      className="inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="size-3.5" />
                      {lang === "zh" ? "删除" : "Delete"}
                    </Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
