import crypto from "node:crypto";
import path from "node:path";

import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { schema } from "@vibeguard/db";

import {
  type OsvDumpEcosystem,
  deleteCachedOsvFile,
  downloadOsvArchiveToCache,
} from "./cache";
import {
  type SecuritySyncStateUpdateInput,
  upsertNormalizedOsvRecord,
  upsertNormalizedOsvRecordsBatch,
} from "./store";
import { normalizeInt } from "../shared/normalize";

export type ContentDb = NodePgDatabase<typeof schema>;

export type FetchText = (url: string, maxBytes?: number) => Promise<string>;

export const UNZIP_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
export const DEFAULT_BOOTSTRAP_BATCH_SIZE = 200;
export const DEFAULT_MODIFIED_ID_ROW_LIMIT = 2000;
export const DEFAULT_MODIFIED_ID_CSV_BYTES = 64 * 1024 * 1024;
export const DEFAULT_VULNERABILITY_TEXT_BYTES = 64 * 1024 * 1024;

export type SyncOsvEcosystemInput = {
  db: ContentDb;
  ecosystem: OsvDumpEcosystem;
  repoRoot?: string;
  limit?: number;
  now?: () => Date;
  fetchText?: FetchText;
  upsertNormalizedOsvRecord?: typeof upsertNormalizedOsvRecord;
  upsertSecuritySyncState?: (
    db: ContentDb,
    scope: string,
    input: SecuritySyncStateUpdateInput,
  ) => Promise<void>;
};

export type SyncAllOsvEcosystemsInput = Omit<SyncOsvEcosystemInput, "ecosystem"> & {
  ecosystems?: readonly OsvDumpEcosystem[];
  syncOne?: (input: SyncOsvEcosystemInput) => Promise<SyncOsvEcosystemSummary>;
};

export type BootstrapOsvEcosystemInput = {
  db: ContentDb;
  ecosystem: OsvDumpEcosystem;
  repoRoot?: string;
  limit?: number;
  batchSize?: number;
  now?: () => Date;
  downloadArchiveToCache?: typeof downloadOsvArchiveToCache;
  iterateArchiveEntries?: (
    archivePath: string,
  ) =>
    | Promise<AsyncIterable<BootstrapArchiveEntry>>
    | AsyncIterable<BootstrapArchiveEntry>;
  deleteCachedFile?: typeof deleteCachedOsvFile;
  upsertNormalizedOsvRecord?: typeof upsertNormalizedOsvRecord;
  upsertNormalizedOsvRecordsBatch?: typeof upsertNormalizedOsvRecordsBatch;
  upsertSecuritySyncState?: (
    db: ContentDb,
    scope: string,
    input: SecuritySyncStateUpdateInput,
  ) => Promise<void>;
};

export type BootstrapAllOsvEcosystemsInput = Omit<
  BootstrapOsvEcosystemInput,
  "ecosystem"
> & {
  ecosystems?: readonly OsvDumpEcosystem[];
  concurrency?: number;
  syncOne?: (
    input: BootstrapOsvEcosystemInput,
  ) => Promise<SyncOsvEcosystemSummary>;
};

export type SyncOsvEcosystemSummary = {
  ecosystem: OsvDumpEcosystem;
  recordsSeen: number;
  recordsImported: number;
  recordsNew: number;
  recordsChanged: number;
  recordsSkipped: number;
  recordsFailed: number;
  lastProcessedModifiedAt: Date | null;
};

export type ModifiedIdRow = {
  modifiedAt: Date;
  externalId: string;
};

export const MAX_MODIFIED_ID_ROW_LIMIT = normalizeInt(
  process.env.VIBEGUARD_OSV_MODIFIED_ID_ROW_LIMIT,
  DEFAULT_MODIFIED_ID_ROW_LIMIT,
);

export const MAX_MODIFIED_ID_CSV_BYTES = normalizeInt(
  process.env.VIBEGUARD_OSV_MODIFIED_ID_CSV_BYTES,
  DEFAULT_MODIFIED_ID_CSV_BYTES,
);

export const MAX_VULNERABILITY_TEXT_BYTES = normalizeInt(
  process.env.VIBEGUARD_OSV_VULNERABILITY_TEXT_BYTES,
  DEFAULT_VULNERABILITY_TEXT_BYTES,
);

export type BootstrapArchiveEntry = {
  entryName: string;
  readText: () => Promise<string>;
};

type YauzlArchiveEntry = {
  filename: string;
  openReadStream: () => Promise<NodeJS.ReadableStream>;
};

type YauzlArchive = AsyncIterable<YauzlArchiveEntry> & {
  close: () => Promise<void>;
};

type YauzlPromiseModule = {
  open: (archivePath: string) => Promise<YauzlArchive>;
};

const YAUZL_PROMISE_MODULE = ["yauzl", "promise"].join("-");

export async function loadYauzlPromise(): Promise<YauzlPromiseModule> {
  return import(YAUZL_PROMISE_MODULE) as Promise<YauzlPromiseModule>;
}

export function parseOsvTimestamp(value: string) {
  const normalized = value.replace(
    /\.(\d{3})\d*Z$/,
    (_match, millis: string) => `.${millis}Z`,
  );
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function assertSafeArchivePath(archivePath: string) {
  const normalized = path.resolve(archivePath);

  if (normalized.includes("\u0000")) {
    throw new Error(`Invalid OSV archive path: ${archivePath}`);
  }

  return normalized;
}

export function toSecurityPackageEcosystem(ecosystem: OsvDumpEcosystem) {
  if (ecosystem === "PyPI") {
    return "pypi";
  }

  if (ecosystem === "crates.io") {
    return "crates-io";
  }

  if (ecosystem === "Go") {
    return "go";
  }

  return ecosystem;
}

export function ensureTextSizeLimit(text: string, label: string, maxBytes: number) {
  const byteLength = Buffer.byteLength(text, "utf8");

  if (byteLength > maxBytes) {
    throw new Error(
      `${label} payload too large (${byteLength} bytes, max ${maxBytes})`,
    );
  }
}

export function sha256(text: string) {
  return `sha256:${crypto.createHash("sha256").update(text).digest("hex")}`;
}

export function parseBootstrapEntryId(entryName: string) {
  const trimmed = entryName.trim();

  if (!trimmed.endsWith(".json") || trimmed.includes("/")) {
    return null;
  }

  return trimmed.slice(0, -".json".length) || null;
}
