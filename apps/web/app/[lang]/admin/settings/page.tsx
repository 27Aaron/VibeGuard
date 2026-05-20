import { AdminPageShell } from "@/components/admin/admin-page-shell"
import { LlmSettingsForm } from "@/components/admin/llm-settings-form"
import { SettingsProfileList } from "@/components/admin/settings-profile-list"
import { getLlmSettingsDetail, getLlmSettingsRows } from "@/lib/admin-data"
import { saveLlmSettingsAction } from "@/lib/actions/settings"
import { resolveLang } from "@/lib/i18n"

export const dynamic = "force-dynamic"

type SettingsPageProps = {
  params: Promise<{ lang: string }>
  searchParams?: Promise<{
    profile?: string
    status?: string
    message?: string
  }>
}

export default async function SettingsPage({ params: routeParams, searchParams }: SettingsPageProps) {
  const { lang: rawLang } = await routeParams
  const params = (await searchParams) ?? {}
  const lang = resolveLang(rawLang)
  const [profiles, settings] = await Promise.all([
    getLlmSettingsRows(),
    getLlmSettingsDetail(params.profile),
  ])
  const selectedProfileId =
    params.profile && params.profile !== "new" ? params.profile : settings.id
  const showBanner = params.status === "success" || params.status === "error"

  return (
    <AdminPageShell
      title={lang === "zh" ? "设置" : "Settings"}
      description={
        lang === "zh"
          ? "配置模型服务、默认模型和内容处理链路的提示词。"
          : "Configure model services, default models, and processing prompts."
      }
      currentNav="/admin/settings"
      lang={lang}
    >
      {showBanner ? (
        <div
          className={`rounded-[1.15rem] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:shadow-none ${
            params.status === "error"
              ? "border-destructive/40 bg-destructive/5 text-destructive dark:bg-destructive/10"
              : "border-emerald-900/18 bg-[#f7fbf8] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100"
          }`}
        >
          {params.message}
        </div>
      ) : null}
      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1.64fr)]">
        <SettingsProfileList
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          lang={lang}
        />
        <LlmSettingsForm
          provider={{
            id: settings.id,
            providerName: settings.providerName,
            settingsName: settings.settingsName,
            baseUrl: settings.baseUrl,
            hasStoredApiKey: settings.hasStoredApiKey,
            model: settings.model,
            isActive: settings.isActive,
          }}
          pipeline={{
            relevancePrompt: settings.relevancePrompt,
            translationTitlePrompt: settings.translationTitlePrompt,
            translationContentPrompt: settings.translationContentPrompt,
            summaryPromptEn: settings.summaryPromptEn,
            summaryPromptZh: settings.summaryPromptZh,
            tagPrompt: settings.tagPrompt,
          }}
          lang={lang}
          action={saveLlmSettingsAction}
        />
      </section>
    </AdminPageShell>
  )
}
