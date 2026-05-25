import { desc, eq, sql } from "drizzle-orm";

import {
  getDb,
  securityAdvisories,
  securityAffectedPackages,
  securityCveEnrichments,
  securitySyncState,
} from "@vibeguard/db";
import { createLogger } from "@vibeguard/shared";

import { requireAdminAuth } from "@/lib/admin-api-auth";

const log = createLogger("api/osv-sync");

export const dynamic = "force-dynamic";

let syncInProgress = false;

export async function GET() {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  const db = getDb();

  const rows = await db.query.securitySyncState.findMany({
    orderBy: [desc(securitySyncState.lastSuccessAt)],
  });

  const sources = rows.map((row) => ({
    source: row.source,
    scope: row.scope,
    status: row.status,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastError: row.lastError ?? null,
    recordsImported: row.recordsImported,
    recordsFailed: row.recordsFailed,
  }));

  const osvEcosystemCounts = Object.fromEntries(
    (
      await db
        .select({
          ecosystem: securityAffectedPackages.ecosystem,
          count: sql<number>`count(distinct ${securityAffectedPackages.advisoryId})`,
        })
        .from(securityAffectedPackages)
        .groupBy(securityAffectedPackages.ecosystem)
    ).map((row) => [row.ecosystem, Number(row.count)]),
  );

  const nvdCount = Number(
    (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(securityCveEnrichments)
        .where(sql`nvd_published_at IS NOT NULL`)
    )[0]?.count ?? 0,
  );

  const kevCount = Number(
    (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(securityCveEnrichments)
        .where(sql`kev_listed = true`)
    )[0]?.count ?? 0,
  );

  const epssCount = Number(
    (
      await db
        .select({ count: sql<number>`count(*)` })
        .from(securityCveEnrichments)
        .where(sql`epss IS NOT NULL`)
    )[0]?.count ?? 0,
  );

  const totalBySourceKey: Record<string, number> = {};

  for (const [eco, count] of Object.entries(osvEcosystemCounts)) {
    totalBySourceKey[`osv:${eco}`] = count;
  }

  totalBySourceKey["nvd:modified"] = nvdCount;
  totalBySourceKey["cisa-kev:global"] = kevCount;
  totalBySourceKey["first-epss:current"] = epssCount;

  const sourcesWithTotals = sources.map((src) => ({
    ...src,
    totalRecords: totalBySourceKey[`${src.source}:${src.scope}`] ?? 0,
  }));

  return Response.json({ sources: sourcesWithTotals });
}

export async function POST() {
  const auth = await requireAdminAuth();
  if (!auth.authorized) return auth.response;

  if (syncInProgress) {
    return Response.json(
      {
        ok: false,
        error:
          "Security sync is already in progress. Please wait for it to finish.",
      },
      { status: 409 },
    );
  }

  syncInProgress = true;
  const logs: string[] = [];

  function appendLog(message: string) {
    log.info(message);
    logs.push(message);
  }

  try {
    appendLog("开始增量同步所有安全数据源…");
    const db = getDb();

    appendLog("正在同步 OSV 漏洞数据库…");
    const { syncAllOsvEcosystems } =
      await import("@vibeguard/content/osv/sync");
    const osvResults = await syncAllOsvEcosystems({ db });
    for (const r of osvResults) {
      appendLog(
        `  OSV/${r.ecosystem}: 导入=${r.recordsImported} 新增=${r.recordsNew} 变更=${r.recordsChanged} 跳过=${r.recordsSkipped} 失败=${r.recordsFailed}`,
      );
    }

    appendLog("正在同步安全增强数据源 (NVD, CISA KEV, EPSS)…");

    const kevBefore =
      Number(
        (
          await db
            .select({ count: sql<number>`count(*)` })
            .from(securityCveEnrichments)
            .where(sql`kev_listed = true`)
        )[0]?.count ?? 0,
      );
    const epssBefore =
      Number(
        (
          await db
            .select({ count: sql<number>`count(*)` })
            .from(securityCveEnrichments)
            .where(sql`epss IS NOT NULL`)
        )[0]?.count ?? 0,
      );

    const { syncAllSecurityEnrichmentSources } =
      await import("@vibeguard/content/security/enrichment");
    const enrichmentResults = await syncAllSecurityEnrichmentSources(db, {
      mode: "incremental",
    });

    const kevAfter =
      Number(
        (
          await db
            .select({ count: sql<number>`count(*)` })
            .from(securityCveEnrichments)
            .where(sql`kev_listed = true`)
        )[0]?.count ?? 0,
      );
    const epssAfter =
      Number(
        (
          await db
            .select({ count: sql<number>`count(*)` })
            .from(securityCveEnrichments)
            .where(sql`epss IS NOT NULL`)
        )[0]?.count ?? 0,
      );

    const snapshotDiff: Record<string, number> = {
      "cisa-kev:global": Math.max(0, kevAfter - kevBefore),
      "first-epss:current": Math.max(0, epssAfter - epssBefore),
    };

    for (const r of enrichmentResults) {
      const diff = snapshotDiff[`${r.source}:${r.scope}`];
      appendLog(
        `  ${r.source}/${r.scope}: 导入=${r.recordsImported}${diff != null && diff > 0 ? ` 新增=${diff}` : ""} 失败=${r.recordsFailed}`,
      );
    }

    appendLog("所有安全数据源同步完成。");

    return Response.json({
      ok: true,
      logs,
      osv: osvResults.map((r) => ({
        ecosystem: r.ecosystem,
        imported: r.recordsImported,
        new: r.recordsNew,
        changed: r.recordsChanged,
        failed: r.recordsFailed,
      })),
      enrichment: enrichmentResults.map((r) => {
        const diff = snapshotDiff[`${r.source}:${r.scope}`];
        return {
          source: r.source,
          scope: r.scope,
          imported: diff != null ? diff : r.recordsImported,
          failed: r.recordsFailed,
        };
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    appendLog(`同步失败: ${message}`);
    return Response.json({ ok: false, error: message, logs }, { status: 500 });
  } finally {
    syncInProgress = false;
  }
}
