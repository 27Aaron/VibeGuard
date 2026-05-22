import { PublicHeader } from "@/components/public-header"
import { PackageCheckWorkbench } from "@/components/security/package-check-workbench"
import { resolveLang } from "@/lib/i18n"
import {
  getBackgroundClassName,
  getBackdropClassName,
  getSectionInnerClassName,
  getSectionOuterClassName,
  getShellClassName,
} from "@/lib/layout-tokens"

export const dynamic = "force-dynamic"

type CheckPageProps = {
  params: Promise<{ lang: string }>
}

export default async function CheckPage({ params: routeParams }: CheckPageProps) {
  const { lang: rawLang } = await routeParams
  const lang = resolveLang(rawLang)
  const nextLang = lang === "zh" ? "en" : "zh"

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
              <PackageCheckWorkbench lang={lang} />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
