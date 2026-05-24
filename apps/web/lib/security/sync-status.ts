import { desc } from "drizzle-orm";

import { securitySyncState } from "@vibeguard/db";

import type { ContentDb } from "./constants";
import { SECURITY_API_STALE_AFTER_MS } from "./constants";
import { dateToIso } from "./formatters";

export async function getSecuritySyncStatus(
  db: ContentDb,
  options: {
    now?: Date;
    staleAfterMs?: number;
  } = {},
) {
  const now = options.now ?? new Date();
  const staleAfterMs = options.staleAfterMs ?? SECURITY_API_STALE_AFTER_MS;
  const rows = await db.query.securitySyncState.findMany({
    orderBy: [desc(securitySyncState.updatedAt)],
  });

  const items = rows.map((row) => {
    const lastSuccessAt = row.lastSuccessAt;
    const stale =
      !lastSuccessAt || now.getTime() - lastSuccessAt.getTime() > staleAfterMs;

    return {
      source: row.source,
      scope: row.scope,
      status: row.status,
      lastProcessedModifiedAt: dateToIso(row.lastProcessedModifiedAt),
      cursorJson: row.cursorJson,
      lastStartedAt: dateToIso(row.lastStartedAt),
      lastSuccessAt: dateToIso(row.lastSuccessAt),
      lastError: row.lastError,
      recordsSeen: row.recordsSeen,
      recordsImported: row.recordsImported,
      recordsFailed: row.recordsFailed,
      updatedAt: dateToIso(row.updatedAt),
      stale,
    };
  });

  return {
    meta: {
      sourceCount: items.length,
      staleAfterMs,
    },
    items,
  };
}
