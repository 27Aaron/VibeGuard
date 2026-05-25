"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppLang } from "@/lib/i18n";

type SyncSource = {
  source: string;
  scope: string;
  status: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  recordsImported: number;
  recordsFailed: number;
  totalRecords: number;
};

function ecosystemLabel(eco: string) {
  switch (eco) {
    case "npm":
      return "npm";
    case "pypi":
      return "PyPI";
    case "go":
      return "Go";
    case "crates-io":
      return "crates.io";
    default:
      return eco;
  }
}

function sourceDisplayName(source: string, scope: string) {
  if (source === "osv") return `OSV (${ecosystemLabel(scope)})`;
  if (source === "nvd") return "NVD";
  if (source === "cisa-kev") return "CISA KEV";
  if (source === "first-epss") return "EPSS";
  return source;
}

function statusBadge(status: string, lang: AppLang) {
  switch (status) {
    case "running":
      return (
        <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          {lang === "zh" ? "同步中" : "Syncing"}
        </Badge>
      );
    case "success":
      return (
        <Badge
          variant="outline"
          className="border-emerald-600/20 text-emerald-700 dark:border-emerald-300/20 dark:text-emerald-300"
        >
          {lang === "zh" ? "正常" : "OK"}
        </Badge>
      );
    case "failed":
      return (
        <Badge
          variant="outline"
          className="border-destructive/40 text-destructive"
        >
          {lang === "zh" ? "失败" : "Failed"}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-zinc-500 dark:text-stone-400">
          {lang === "zh" ? "待同步" : "Idle"}
        </Badge>
      );
  }
}

function formatCount(n: number) {
  return n.toLocaleString();
}

type SyncResult = {
  logs?: string[];
  osv?: Array<{ ecosystem: string; imported: number }>;
  enrichment?: Array<{ source: string; scope: string; imported: number }>;
};

export function SecuritySyncButton({
  lang,
  onSyncComplete,
}: {
  lang: AppLang;
  onSyncComplete?: (result: SyncResult) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/osv-sync", { method: "POST" });
      const data: SyncResult & { ok?: boolean; error?: string } =
        await res.json();

      if (!data.ok) {
        setError(data.error ?? "Unknown error");
      }

      onSyncComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSyncing(false);
    }
  }

  const syncLabel = syncing
    ? lang === "zh"
      ? "同步中…"
      : "Syncing…"
    : lang === "zh"
      ? "同步全部来源"
      : "Sync All Sources";

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
        <p className="text-xs text-destructive" aria-live="polite">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {syncing
            ? lang === "zh"
              ? "正在同步所有安全数据源…"
              : "Syncing all security sources…"
            : lang === "zh"
              ? "手动触发全部安全数据源增量同步（OSV、NVD、CISA KEV、EPSS）。"
              : "Manually trigger incremental sync for all security sources (OSV, NVD, CISA KEV, EPSS)."}
        </p>
      )}
    </div>
  );
}

function SourceCard({
  src,
  newCount,
  lang,
  icon,
  label,
}: {
  src: SyncSource;
  newCount?: number;
  lang: AppLang;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-black/5 bg-white/68 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:shadow-none">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 rounded-full border border-black/6 bg-[#f7fbf8] p-1.5 text-emerald-800 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[#18241e] dark:text-emerald-300 dark:shadow-none">
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold text-zinc-950 dark:text-stone-100">
            {label}
          </span>
          <span className="text-xs text-zinc-500 dark:text-stone-400">
            {formatCount(src.totalRecords)} {lang === "zh" ? "条" : "records"}
            {newCount && newCount > 0 ? (
              <span className="ml-1 text-emerald-700 dark:text-emerald-300">
                +{newCount}
              </span>
            ) : null}
          </span>
        </div>
      </div>
      {statusBadge(src.status, lang)}
    </div>
  );
}

const NEW_RECORDS_TTL_MS = 60_000;

export function SecuritySyncPanel({ lang }: { lang: AppLang }) {
  const [sources, setSources] = useState<SyncSource[]>([]);
  const [syncLogs, setSyncLogs] = useState<string[] | null>(null);
  const [newRecords, setNewRecords] = useState<Record<string, number>>({});

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/osv-sync", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  function handleSyncComplete(result: SyncResult) {
    if (result.logs) setSyncLogs(result.logs);

    const map: Record<string, number> = {};
    for (const r of result.osv ?? []) {
      map[`osv:${r.ecosystem}`] = r.imported;
    }
    for (const r of result.enrichment ?? []) {
      map[`${r.source}:${r.scope}`] = r.imported;
    }
    setNewRecords(map);

    setTimeout(() => setNewRecords({}), NEW_RECORDS_TTL_MS);
    fetchStatus();
  }

  const displaySources = sources.filter(
    (s) => s.scope !== "full" && !s.scope.startsWith("year-"),
  );

  const osvSources = displaySources.filter((s) => s.source === "osv");
  const enrichmentSources = displaySources.filter((s) => s.source !== "osv");

  const osvTotal = osvSources.reduce((sum, s) => sum + s.totalRecords, 0);
  const enrichmentTotal = enrichmentSources.reduce(
    (sum, s) => sum + s.totalRecords,
    0,
  );

  if (displaySources.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <SecuritySyncButton lang={lang} onSyncComplete={handleSyncComplete} />
        <p className="text-sm text-muted-foreground">
          {lang === "zh"
            ? "暂无同步记录，首次同步后将显示状态。"
            : "No sync records yet. Status will appear after the first sync."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <SecuritySyncButton lang={lang} onSyncComplete={handleSyncComplete} />

      <div className="grid grid-cols-2 gap-2">
        {osvSources.map((src) => (
          <SourceCard
            key={`${src.source}-${src.scope}`}
            src={src}
            newCount={newRecords[`${src.source}:${src.scope}`]}
            lang={lang}
            icon={<Database className="size-3.5" />}
            label={ecosystemLabel(src.scope)}
          />
        ))}
        {enrichmentSources.map((src) => (
          <SourceCard
            key={`${src.source}-${src.scope}`}
            src={src}
            newCount={newRecords[`${src.source}:${src.scope}`]}
            lang={lang}
            icon={<Shield className="size-3.5" />}
            label={sourceDisplayName(src.source, src.scope)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between rounded-lg border border-black/5 bg-white/40 px-3 py-2 dark:border-white/5 dark:bg-white/[0.02]">
        <span className="text-xs text-muted-foreground">
          {lang === "zh" ? "合计" : "Total"}
        </span>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {osvSources.length > 0 ? (
            <span>
              OSV {formatCount(osvTotal)} {lang === "zh" ? "条" : "records"}
            </span>
          ) : null}
          {enrichmentSources.length > 0 ? (
            <span>
              {lang === "zh" ? "增强" : "Enrichment"}{" "}
              {formatCount(enrichmentTotal)} {lang === "zh" ? "条" : "records"}
            </span>
          ) : null}
        </div>
      </div>

      {syncLogs && syncLogs.length > 0 ? (
        <div className="rounded-[0.9rem] border border-black/5 bg-white/60 p-3 dark:border-white/10 dark:bg-white/4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {lang === "zh" ? "同步日志" : "Sync Logs"}
            </span>
            <button
              type="button"
              onClick={() => setSyncLogs(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {lang === "zh" ? "关闭" : "Dismiss"}
            </button>
          </div>
          <pre className="overflow-x-auto text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap font-mono">
            {syncLogs.join("\n")}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
