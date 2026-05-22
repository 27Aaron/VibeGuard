"use client"

import { type FormEvent, useState } from "react"

import {
  SECURITY_PACKAGE_ECOSYSTEM_VALUES,
  type SecurityPackageEcosystem,
} from "@vibeguard/shared"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getAdminSelectClassName, getAdminSubtlePanelClassName } from "@/lib/admin-layout"
import type { AppLang } from "@/lib/i18n"
import { getUiText } from "@/lib/i18n"
import {
  buildSecurityCheckRequestBody,
  parseSecurityCheckPayload,
  buildSecurityWorkbenchResultState,
  getSecurityFindingTone,
  type SecurityFinding,
} from "@/lib/security-workbench"
import { cn } from "@/lib/utils"

type PackageCheckWorkbenchProps = {
  lang: AppLang
}

type PackageCheckWorkbenchResult = ReturnType<typeof buildSecurityWorkbenchResultState>

function ecosystemLabel(ecosystem: SecurityPackageEcosystem) {
  switch (ecosystem) {
    case "pypi":
      return "PyPI"
    case "go":
      return "Go"
    case "crates-io":
      return "crates.io"
    default:
      return ecosystem
  }
}

function toneBadgeVariant(finding: SecurityFinding) {
  switch (getSecurityFindingTone(finding)) {
    case "hit":
      return "destructive"
    case "inconclusive":
      return "outline"
    case "clear":
      return "secondary"
    default:
      return "outline"
  }
}

function toneLabel(finding: SecurityFinding, lang: AppLang) {
  switch (getSecurityFindingTone(finding)) {
    case "hit":
      return lang === "zh" ? "已命中" : "Match"
    case "inconclusive":
      return lang === "zh" ? "待确认" : "Inconclusive"
    case "clear":
      return lang === "zh" ? "未命中" : "Clear"
    default:
      return lang === "zh" ? "结果" : "Result"
  }
}

async function parseCheckResponse(response: Response) {
  const payload = await response.json().catch(() => null) as
    | { message?: string }
    | unknown

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : `Request failed with status ${response.status}.`

    throw new Error(message)
  }

  return parseSecurityCheckPayload(payload)
}

export function PackageCheckWorkbench({ lang }: PackageCheckWorkbenchProps) {
  const copy = getUiText(lang)
  const [ecosystem, setEcosystem] = useState<SecurityPackageEcosystem>("npm")
  const [packageName, setPackageName] = useState("")
  const [version, setVersion] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PackageCheckWorkbenchResult | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setPending(true)
    setError(null)
    setResult(null)

    try {
      const payload = await parseCheckResponse(
        await fetch("/api/security/check/packages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            buildSecurityCheckRequestBody({
              ecosystem,
              name: packageName,
              version,
            }),
          ),
        }),
      )

      setResult(buildSecurityWorkbenchResultState(payload))
    } catch (submitError) {
      setResult(null)
      setError(
        submitError instanceof Error
          ? submitError.message
          : lang === "zh"
            ? "查询失败，请稍后再试。"
            : "The check failed. Please try again.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <form className="grid gap-4 pt-5 lg:grid-cols-[minmax(0,180px)_minmax(0,1fr)_minmax(0,220px)_auto]" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label htmlFor="security-ecosystem" className="text-sm font-medium">
              {lang === "zh" ? "生态" : "Ecosystem"}
            </label>
            <select
              id="security-ecosystem"
              className={getAdminSelectClassName()}
              value={ecosystem}
              onChange={(event) => setEcosystem(event.target.value as SecurityPackageEcosystem)}
              disabled={pending}
            >
              {SECURITY_PACKAGE_ECOSYSTEM_VALUES.map((option) => (
                <option key={option} value={option}>
                  {ecosystemLabel(option)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="security-package-name" className="text-sm font-medium">
              {copy.publicCheckPackageName}
            </label>
            <Input
              id="security-package-name"
              value={packageName}
              onChange={(event) => setPackageName(event.target.value)}
              placeholder={ecosystem === "npm" ? "@scope/package" : "package-name"}
              disabled={pending}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="security-package-version" className="text-sm font-medium">
              {copy.publicCheckVersion}
            </label>
            <Input
              id="security-package-version"
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="1.0.0"
              disabled={pending}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={pending || !packageName.trim()} className="w-full lg:w-auto">
              {pending ? copy.publicCheckSubmitting : copy.publicCheckSubmit}
            </Button>
          </div>
        </form>

        {error ? (
          <div
            className="rounded-[1.15rem] border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:bg-destructive/10 dark:shadow-none"
            aria-live="polite"
          >
            {error}
          </div>
        ) : null}

        {result?.warning ? (
          <div
            className="rounded-[1.15rem] border border-black/8 bg-white/75 px-4 py-3 text-sm text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.045] dark:text-stone-200 dark:shadow-none"
            aria-live="polite"
          >
            {result.warning}
          </div>
        ) : null}

        {!result ? (
          <section className={cn("text-sm text-zinc-600 dark:text-stone-300", getAdminSubtlePanelClassName())}>
            <p>{copy.publicCheckEmpty}</p>
          </section>
        ) : result.empty ? (
          <section className={cn("space-y-2", getAdminSubtlePanelClassName())}>
            <p className="text-sm text-zinc-700 dark:text-stone-200">{copy.publicCheckNoFindings}</p>
          </section>
        ) : (
          <section className="space-y-3">
            {result.findings.map((finding, index) => (
              <article
                key={`${finding.advisory.id}-${finding.package.name}-${index}`}
                className={cn("space-y-3", getAdminSubtlePanelClassName())}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-zinc-950 dark:text-stone-50">
                      {finding.matchSummary}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-stone-400">
                      {finding.matchReason} · {finding.confidence}
                    </p>
                  </div>
                  <Badge variant={toneBadgeVariant(finding)}>{toneLabel(finding, lang)}</Badge>
                </div>

                {finding.affectedPackage.fixedVersions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                      {lang === "zh" ? "已知修复版本" : "Known fixed versions"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {finding.affectedPackage.fixedVersions.map((fixedVersion) => (
                        <Badge key={fixedVersion} variant="secondary">
                          {fixedVersion}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {finding.advisory.references.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-800 dark:text-stone-100">
                      {lang === "zh" ? "参考链接" : "References"}
                    </p>
                    <ul className="space-y-1 text-xs text-zinc-500 dark:text-stone-400">
                      {finding.advisory.references.map((reference) => (
                        <li key={reference.url} className="break-all">
                          <a
                            href={reference.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-950 dark:decoration-white/20 dark:hover:text-stone-50"
                          >
                            {reference.type ? `${reference.type}: ` : ""}
                            {reference.url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </section>
        )}
      </CardContent>
      <CardFooter className="justify-end text-xs text-zinc-500 dark:text-stone-400">
        <span>{copy.publicCheckFootnote}</span>
      </CardFooter>
    </Card>
  )
}
