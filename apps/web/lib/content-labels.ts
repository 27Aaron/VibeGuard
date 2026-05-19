import type { AppLang } from "./i18n"

const ECOSYSTEM_LABELS: Record<AppLang, Record<string, string>> = {
  zh: {
    unknown: "未知",
    npm: "npm",
    pypi: "PyPI",
    maven: "Maven",
    go: "Go",
    "crates-io": "crates.io",
    "github-actions": "GitHub Actions",
    docker: "Docker",
    multi: "多生态",
  },
  en: {
    unknown: "Unknown",
    npm: "npm",
    pypi: "PyPI",
    maven: "Maven",
    go: "Go",
    "crates-io": "crates.io",
    "github-actions": "GitHub Actions",
    docker: "Docker",
    multi: "Multi-ecosystem",
  },
}

const RISK_CATEGORY_LABELS: Record<AppLang, Record<string, string>> = {
  zh: {
    unknown: "未知",
    vulnerability: "漏洞",
    "exploit-activity": "利用活动",
    "malicious-package": "恶意包",
    "supply-chain-attack": "供应链攻击",
    "dependency-risk": "依赖风险",
  },
  en: {
    unknown: "Unknown",
    vulnerability: "Vulnerability",
    "exploit-activity": "Exploit activity",
    "malicious-package": "Malicious package",
    "supply-chain-attack": "Supply-chain attack",
    "dependency-risk": "Dependency risk",
  },
}

const ARTICLE_STATUS_LABELS: Record<AppLang, Record<string, string>> = {
  zh: {
    pending: "待处理",
    processing: "处理中",
    ready: "已就绪",
    failed: "失败",
    filtered: "已过滤",
  },
  en: {
    pending: "Pending",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
    filtered: "Filtered",
  },
}

export function getEcosystemLabel(value: string, lang: AppLang = "zh") {
  return ECOSYSTEM_LABELS[lang][value] ?? value
}

export function getRiskCategoryLabel(value: string, lang: AppLang = "zh") {
  return RISK_CATEGORY_LABELS[lang][value] ?? value
}

export function getArticleStatusLabel(value: string, lang: AppLang = "zh") {
  return ARTICLE_STATUS_LABELS[lang][value] ?? value
}
