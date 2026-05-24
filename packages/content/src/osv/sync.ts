import { OSV_DUMP_ECOSYSTEMS } from "./cache";
import { bootstrapOsvEcosystem } from "./sync-bootstrap";
import {
  syncOsvEcosystem,
} from "./sync-incremental";
import {
  type BootstrapAllOsvEcosystemsInput,
  type BootstrapOsvEcosystemInput,
  type SyncAllOsvEcosystemsInput,
  type SyncOsvEcosystemInput,
  type SyncOsvEcosystemSummary,
} from "./sync-types";
import {
  buildBootstrapArchiveEntriesListCommand,
  buildModifiedIdCsvUrl,
  parseModifiedIdCsv,
} from "./sync-utils";

export {
  type SyncOsvEcosystemSummary,
  type SyncOsvEcosystemInput,
  type SyncAllOsvEcosystemsInput,
  type BootstrapOsvEcosystemInput,
  type BootstrapAllOsvEcosystemsInput,
} from "./sync-types";

export {
  buildModifiedIdCsvUrl,
  parseModifiedIdCsv,
  buildBootstrapArchiveEntriesListCommand,
} from "./sync-utils";

export { syncOsvEcosystem } from "./sync-incremental";

export { bootstrapOsvEcosystem } from "./sync-bootstrap";

export async function syncAllOsvEcosystems({
  ecosystems = OSV_DUMP_ECOSYSTEMS,
  syncOne = syncOsvEcosystem,
  ...input
}: SyncAllOsvEcosystemsInput) {
  const results = [];

  for (const ecosystem of ecosystems) {
    results.push(await syncOne({ ...input, ecosystem }));
  }

  return results;
}

export async function bootstrapAllOsvEcosystems({
  ecosystems = OSV_DUMP_ECOSYSTEMS,
  concurrency = 2,
  syncOne = bootstrapOsvEcosystem,
  ...input
}: BootstrapAllOsvEcosystemsInput) {
  const results = new Array<SyncOsvEcosystemSummary>(ecosystems.length);
  const maxConcurrency = Math.max(1, Math.floor(concurrency));
  // 共享的索引计数器是线程安全的：JavaScript 运行时是单线程的，索引的读取和自增操作
  // 在任何 await 之前同步完成，因此在 Promise.all 并发工作池中不会出现数据竞争。
  let nextIndex = 0;

  async function runOne() {
    while (nextIndex < ecosystems.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const ecosystem = ecosystems[currentIndex]!;

      results[currentIndex] = await syncOne({ ...input, ecosystem });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(maxConcurrency, ecosystems.length) }, () =>
      runOne(),
    ),
  );

  return results;
}
