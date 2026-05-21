import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { SecurityWorkbench } from "@/components/admin/security-workbench"
import { getUiText, resolveLang } from "@/lib/i18n"

type SecurityPageProps = {
  params: Promise<{ lang: string }>
}

export default async function SecurityPage({ params: routeParams }: SecurityPageProps) {
  const { lang: rawLang } = await routeParams
  const lang = resolveLang(rawLang)
  const copy = getUiText(lang)

  return (
    <AdminPageShell
      title={copy.adminSecurityTitle}
      description={copy.adminSecurityDescription}
      currentNav="/admin/security"
      lang={lang}
    >
      <SecurityWorkbench lang={lang} />
    </AdminPageShell>
  )
}
