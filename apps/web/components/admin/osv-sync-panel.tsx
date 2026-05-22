"use client"

import { useCallback, useEffect, useState } from "react"
import { Database, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AppLang } from "@/lib/i18n"
import { formatDateTimeInShanghai } from "@/lib/time"
import { cn } from "@/lib/utils"

type OsvSyncEcosystem = {
  ecosystem: string
  status: string
  lastSuccessAt: string | null
  lastError: string | null
  recordsImported: number
  recordsFailed: number
}

type OsvSyncPanelProps = {
  lang: AppLang
}

function ecosystemLabel(eco: string) {
  switch (eco) {
    case "npm":
      return "npm"
    case "pypi":
      return "PyPI"
    case "go":
      return "Go"
    case "crates-io":
      return "crates.io"
    default:
      return eco
  }
}

function statusBadge(status: string, lang: AppLang) {
  switch (status) {
    case "running":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {lang === "zh" ? "同步中" : "Syncing"}
        </Badge>
      )
    case "success":
      return (
        <Badge variant="outline" className="border-emerald-600/20 text-emerald-700 dark:border-emerald-300/20 dark:text-emerald-300">
          {lang === "zh" ? "正常" : "OK"}
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          {lang === "zh" ? "失败" : "Failed"}
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-zinc-500 dark:text-stone-400">
          {lang === "zh" ? "待同步" : "Idle"}
        </Badge>
      )
  }
}

export function OsvSyncPanel({ lang }: OsvSyncPanelProps) {
  const [ecosystems, setEcosystems] = useState<OsvSyncEcosystem[]>([])
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/osv-sync", { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setEcosystems(data.ecosystems ?? [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  async function handleSync() {
    setSyncing(true)
    setError(null)

    try {
      const res = await fetch("/api/admin/osv-sync", { method: "POST" })
      const data = await res.json()

      if (!data.ok) {
        setError(data.error ?? "Unknown error")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setSyncing(false)
      await fetchStatus()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={syncing}
          variant="outline"
          size="lg"
          onClick={handleSync}
          className="w-full justify-between rounded-full border-emerald-900/14 bg-[#f7fbf8] text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.10),0_5px_12px_rgba(20,83,45,0.10)] hover:border-emerald-900/22 hover:bg-white dark:border-emerald-200/14 dark:bg-[#18241e] dark:text-emerald-100 dark:shadow-none dark:hover:border-emerald-200/24 dark:hover:bg-[#1b2a22] sm:w-auto"
        >
          <span>{syncing ? (lang === "zh" ? "同步中…" : "Syncing…") : (lang === "zh" ? "同步漏洞库" : "Sync Vulnerability DB")}</span>
          <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
        </Button>
      </div>

      {error ? (
        <div className="rounded-[1.15rem] border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive dark:bg-destructive/10">
          {error}
        </div>
      ) : null}

      {ecosystems.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {ecosystems.map((eco) => (
            <div
              key={eco.ecosystem}
              className="flex items-center justify-between gap-3 rounded-[0.85rem] border border-black/5 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-center gap-2">
                <Database className="size-3.5 text-zinc-400 dark:text-stone-500" />
                <span className="text-sm font-medium text-zinc-950 dark:text-stone-100">
                  {ecosystemLabel(eco.ecosystem)}
                </span>
                {statusBadge(eco.status, lang)}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-stone-400">
                <span>
                  {lang === "zh" ? "已导入" : "Imported"} {eco.recordsImported}
                </span>
                {eco.lastSuccessAt ? (
                  <span className="hidden sm:inline">
                    {formatDateTimeInShanghai(eco.lastSuccessAt, { lang })}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {lang === "zh" ? "暂无同步记录，首次同步后将显示状态。" : "No sync records yet. Status will appear after the first sync."}
        </p>
      )}
    </div>
  )
}
