import type { AppLang } from "./i18n"

export function buildSelectedJobsQueuedMessage(input: {
  lang: AppLang
  queuedCount: number
  backgroundStartLimit: number
}) {
  const startedCount = Math.min(input.queuedCount, input.backgroundStartLimit)

  if (input.queuedCount > input.backgroundStartLimit) {
    return input.lang === "zh"
      ? `已将 ${input.queuedCount} 个任务加入队列，正在后台处理前 ${startedCount} 个，其余会等待下一轮处理。`
      : `${input.queuedCount} jobs queued. The first ${startedCount} are processing in background; the rest will wait for the next worker run.`
  }

  return input.lang === "zh"
    ? `已将 ${input.queuedCount} 个任务加入队列，后台正在处理中。`
    : `${input.queuedCount} jobs queued — processing in background.`
}
