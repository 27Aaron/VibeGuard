import type { AppLang } from "./i18n";

export function buildSelectedJobsQueuedMessage(input: {
  lang: AppLang;
  queuedCount: number;
  backgroundStartLimit: number;
}) {
  const startedCount = Math.min(input.queuedCount, input.backgroundStartLimit);

  if (input.queuedCount > input.backgroundStartLimit) {
    return input.lang === "zh"
      ? `已将 ${input.queuedCount} 个任务加入队列，常驻 Worker 会同时最多处理 ${startedCount} 个，完成一个会继续补一个。`
      : `${input.queuedCount} jobs queued. The persistent worker will keep up to ${startedCount} running at once and refill each slot as jobs finish.`;
  }

  return input.lang === "zh"
    ? `已将 ${input.queuedCount} 个任务加入队列，常驻 Worker 会按最多 ${startedCount} 个并发处理。`
    : `${input.queuedCount} jobs queued. The persistent worker will process them with up to ${startedCount} concurrent jobs.`;
}
