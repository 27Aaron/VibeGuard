import { PublicHeader } from "@/components/public-header"
import { PackageCheckWorkbench } from "@/components/security/package-check-workbench"
import { getUiText, resolveLang } from "@/lib/i18n"
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
  const copy = getUiText(lang)
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
            <div className="space-y-2 p-5 sm:p-7">
              <h1 className="text-2xl font-semibold leading-tight tracking-normal text-zinc-950 md:text-3xl dark:text-stone-50">
                {copy.publicCheckTitle}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-stone-300">
                {copy.publicCheckDescription}
              </p>
            </div>
          </div>
        </section>

        <section className={getSectionOuterClassName()}>
          <div className={getSectionInnerClassName()}>
            <div className="p-5 sm:p-7">
              <PackageCheckWorkbench lang={lang} />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
