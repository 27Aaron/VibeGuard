import { PublicHeader } from "@/components/public-header"
import { PackageCheckWorkbench } from "@/components/security/package-check-workbench"
import { getDb } from "@vibeguard/db"
import { resolveLang } from "@/lib/i18n"
import {
  getBackgroundClassName,
  getBackdropClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
} from "@/lib/layout-tokens"
import { getSecurityOverviewTotals } from "@/lib/security-overview"

export const dynamic = "force-dynamic"

type CheckPageProps = {
  params: Promise<{ lang: string }>
}

export default async function CheckPage({ params: routeParams }: CheckPageProps) {
  const { lang: rawLang } = await routeParams
  const lang = resolveLang(rawLang)
  const nextLang = lang === "zh" ? "en" : "zh"
  const overviewTotals = await getSecurityOverviewTotals(getDb())

  return (
    <main className={getBackgroundClassName()}>
      <div className={getBackdropClassName()} />

      <div className={getShellClassName()}>
        <PublicHeader
          homeHref={`/${lang}`}
          nextLangHref={`/${nextLang}/check`}
          currentLang={lang}
          currentSurface="check"
        />

        <section className={getSectionOuterClassName()}>
          <div className={getSectionInnerClassName()}>
            <div className="mt-4">
              <PackageCheckWorkbench lang={lang} initialOverviewTotals={overviewTotals} />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
