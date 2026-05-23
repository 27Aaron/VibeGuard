"use client"

import { useCallback, useEffect, useState } from "react"
import { Database, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { AppLang } from "@/lib/i18n"
import { formatDateTimeInShanghai } from "@/lib/time"

type OsvSyncEcosystem = {
  ecosystem: string
  status: string
  lastSuccessAt: string | null
  lastError: string | null
  recordsImported: number
  recordsFailed: number
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

export function OsvSyncButton({ lang, onSyncComplete }: { lang: AppLang; onSyncComplete?: () => void }) {
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      onSyncComplete?.()
    }
  }

  const syncLabel = syncing
    ? (lang === "zh" ? "同步中…" : "Syncing…")
    : (lang === "zh" ? "同步漏洞库" : "Sync Vuln DB")

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        disabled={syncing}
        variant="outline"
        size="lg"
        onClick={handleSync}
        className="justify-between rounded-full border-emerald-900/14 bg-[#f7fbf8] text-emerald-950 shadow-[0_1px_2px_rgba(15,23,42,0.10),0_5px_12px_rgba(20,83,45,0.10)] hover:border-emerald-900/22 hover:bg-white dark:border-emerald-200/14 dark:bg-[#18241e] dark:text-emerald-100 dark:shadow-none dark:hover:border-emerald-200/24 dark:hover:bg-[#1b2a22]"
      >
        <span>{syncLabel}</span>
        <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
      </Button>
      {error ? (
        <p className="text-xs text-destructive" aria-live="polite">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {syncing
            ? (lang === "zh" ? "正在同步漏洞数据库…" : "Syncing vulnerability database…")
            : (lang === "zh" ? "手动同步 OSV 漏洞库到本地。" : "Manually sync the OSV vulnerability database.")}
        </p>
      )}
    </div>
  )
}

export function OsvSyncPanel({ lang }: { lang: AppLang }) {
  const [ecosystems, setEcosystems] = useState<OsvSyncEcosystem[]>([])

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

  if (ecosystems.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <OsvSyncButton lang={lang} onSyncComplete={fetchStatus} />
        <p className="text-sm text-muted-foreground">
          {lang === "zh" ? "暂无同步记录，首次同步后将显示状态。" : "No sync records yet. Status will appear after the first sync."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <OsvSyncButton lang={lang} onSyncComplete={fetchStatus} />
      <div className="grid grid-cols-2 gap-2">
        {ecosystems.map((eco) => (
          <div
            key={eco.ecosystem}
            className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-black/5 bg-white/68 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-black/6 bg-[#f7fbf8] p-1.5 text-emerald-800 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#18241e] dark:text-emerald-300 dark:shadow-none">
                <Database className="size-3.5" />
              </span>
              <span className="text-sm font-semibold text-zinc-950 dark:text-stone-100">
                {ecosystemLabel(eco.ecosystem)}
              </span>
              {statusBadge(eco.status, lang)}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-stone-400">
              <span>{eco.recordsImported}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
