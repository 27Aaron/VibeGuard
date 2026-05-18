export type AppLang = "zh" | "en"

export function resolveLang(value: string | null | undefined): AppLang {
  return value === "en" ? "en" : "zh"
}

export function withLang(path: string, lang: AppLang) {
  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}lang=${lang}`
}

export function upsertLangInSearchParams(
  searchParams: URLSearchParams,
  lang: AppLang,
) {
  const next = new URLSearchParams(searchParams)
  next.set("lang", lang)
  return next
}

export const uiText = {
  zh: {
    languageName: "中文",
    oppositeLanguageName: "英文",
    zhLabel: "中文",
    enLabel: "英文",
    languageToggleAdmin: "后台",
    publicBrand: "VibeGuard",
    publicBrandBadge: "风险流",
    publicBrandDescription: "把供应链攻击、恶意包与高危漏洞线索收进一个更清晰的阅读流里。",
    publicEyebrowLive: "风险信号",
    publicHeroTitle: "一个更适合中文用户浏览的开源风险情报首页。",
    publicHeroBody:
      "从安全内容源中抓取、整理并转成双语摘要，方便你先快速扫一眼，再决定哪篇值得点进去。",
    publicEnabledSources: "已启用来源",
    publicSearchPlaceholder: "搜索标题、摘要或标签",
    search: "搜索",
    clear: "清除",
    allSources: "全部来源",
    currentFilters: "当前筛选",
    clearAllFilters: "清空全部筛选",
    sourceLabel: "来源",
    keywordLabel: "关键词",
    ecosystemLabel: "生态",
    riskLabel: "风险",
    emptyFeedTitle: "还没有可展示的文章。",
    emptyFeedBody: "先在后台添加来源并执行一轮处理，再回来这里查看内容。",
    openAdmin: "打开后台",
    pagePrev: "上一页",
    pageNext: "下一页",
    backToFeed: "返回文章流",
    readSource: "查看原文",
    canonicalUrl: "原始规范链接",
    summaryMissing: "这篇文章的摘要暂时还没有生成。",
    summaryPanelTitle: "摘要",
    summaryPanelTags: "关键词标签",
    contentMissing: "正文内容暂时还没有准备好。",
    codeLabel: "代码",
    copyCode: "复制代码",
    copiedCode: "已复制",
    rssFeedTitle: "VibeGuard 中文订阅",
    rssFeedTitleWithSource: (source: string) => `VibeGuard 中文订阅 - ${source}`,
    rssFeedDescription: "面向中文用户的供应链攻击、依赖风险与开源安全内容流。",
    rssFeedDescriptionWithSource: (source: string) =>
      `面向中文用户的供应链攻击、依赖风险与开源安全内容流。当前来源：${source}。`,
    adminNavOverview: "总览",
    adminNavFeeds: "来源",
    adminNavArticles: "文章",
    adminNavJobs: "任务",
    adminNavSettings: "设置",
    adminRunWorker: "抓取并处理一次",
    adminRunWorkerPending: "执行中...",
    adminRunWorkerHint:
      "用于手动抓取已启用来源，并处理当前排队中的文章任务。",
    adminRunWorkerPendingHint:
      "Worker 正在抓取来源并处理任务，暂时禁用重复触发。",
  },
  en: {
    languageName: "English",
    oppositeLanguageName: "Chinese",
    zhLabel: "Chinese",
    enLabel: "English",
    languageToggleAdmin: "Admin",
    publicBrand: "VibeGuard",
    publicBrandBadge: "ORW",
    publicBrandDescription:
      "A calmer reading stream for supply-chain attacks, malicious packages, and critical vulnerability signals.",
    publicEyebrowLive: "Risk signals",
    publicHeroTitle: "An open-source risk intelligence homepage built for fast scanning.",
    publicHeroBody:
      "Ingest security sources, structure them, and turn them into bilingual summaries so you can decide what deserves a deeper read.",
    publicEnabledSources: "Enabled sources",
    publicSearchPlaceholder: "Search titles, summaries, or tags",
    search: "Search",
    clear: "Clear",
    allSources: "All sources",
    currentFilters: "Active filters",
    clearAllFilters: "Clear all filters",
    sourceLabel: "Source",
    keywordLabel: "Keyword",
    ecosystemLabel: "Ecosystem",
    riskLabel: "Risk",
    emptyFeedTitle: "No readable articles yet.",
    emptyFeedBody:
      "Add a source in the admin area and run one processing cycle, then come back here.",
    openAdmin: "Open admin",
    pagePrev: "Previous",
    pageNext: "Next",
    backToFeed: "Back to feed",
    readSource: "Open source article",
    canonicalUrl: "Canonical URL",
    summaryMissing: "A summary is not available for this article yet.",
    summaryPanelTitle: "Summary",
    summaryPanelTags: "Tags",
    contentMissing: "The article body is not ready yet.",
    codeLabel: "Code",
    copyCode: "Copy code",
    copiedCode: "Copied",
    rssFeedTitle: "VibeGuard English Feed",
    rssFeedTitleWithSource: (source: string) =>
      `VibeGuard English Feed - ${source}`,
    rssFeedDescription:
      "A bilingual stream of supply-chain attacks, dependency risk, and open-source security updates.",
    rssFeedDescriptionWithSource: (source: string) =>
      `A bilingual stream of supply-chain attacks, dependency risk, and open-source security updates. Source filter: ${source}.`,
    adminNavOverview: "Overview",
    adminNavFeeds: "Sources",
    adminNavArticles: "Articles",
    adminNavJobs: "Jobs",
    adminNavSettings: "Settings",
    adminRunWorker: "Fetch and process once",
    adminRunWorkerPending: "Running...",
    adminRunWorkerHint:
      "Manually fetch enabled sources and process the queued article jobs.",
    adminRunWorkerPendingHint:
      "The worker is fetching sources and processing jobs. Repeated triggers are disabled for now.",
  },
} as const

export function getUiText(lang: AppLang) {
  return uiText[lang]
}
