"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, ChevronRight, PlusCircle, Trash2 } from "lucide-react"

import type {
  LlmSettingsRow,
  PipelineSettings,
  ProviderSettings,
} from "@/components/admin/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  IDLE_FORM_ACTION_RESULT,
  type FormActionResult,
} from "@/lib/action-result"
import { getAdminSelectClassName } from "@/lib/admin-layout"
import {
  activateLlmSettingsAction,
  deleteLlmSettingsAction,
} from "@/lib/actions/settings"
import type { AppLang } from "@/lib/i18n"
import { resolveLang } from "@/lib/i18n"
import { mergeModelOptions } from "@/lib/provider-models"
import { cn } from "@/lib/utils"

function FeedbackMessage({ state }: { state: FormActionResult }) {
  if (state.status === "idle") {
    return null
  }

  return (
    <div
      className={`rounded-[1.15rem] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:shadow-none ${
        state.status === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive dark:bg-destructive/10"
          : "border-emerald-900/18 bg-[#f7fbf8] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100"
      }`}
      aria-live="polite"
    >
      {state.message}
    </div>
  )
}

function CollapsiblePromptField({
  id,
  name,
  label,
  value,
  onChange,
  lang,
}: {
  id: string
  name: string
  label: string
  value: string
  onChange: (value: string) => void
  lang: AppLang
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col gap-2 rounded-[1.15rem] border border-black/5 bg-white/58 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronDown className="size-3.5" />
              {lang === "zh" ? "收起" : "Collapse"}
            </>
          ) : (
            <>
              <ChevronRight className="size-3.5" />
              {lang === "zh" ? "展开" : "Expand"}
            </>
          )}
        </Button>
      </div>
      {expanded ? (
        <Textarea
          id={id}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <>
          <input type="hidden" name={name} value={value} />
          <div
            className="line-clamp-2 cursor-pointer rounded-md border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground leading-relaxed hover:bg-muted/50"
            onClick={() => setExpanded(true)}
          >
            {value || (lang === "zh" ? "未配置" : "Not configured")}
          </div>
        </>
      )}
    </div>
  )
}

type LlmSettingsFormProps = {
  profiles: LlmSettingsRow[]
  selectedProfileId?: string
  provider: ProviderSettings
  pipeline: PipelineSettings
  lang: AppLang
  action: (
    previousState: FormActionResult,
    formData: FormData,
  ) => Promise<FormActionResult>
}

function SubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string
  pendingLabel: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending}>
      {pending ? pendingLabel : idleLabel}
    </Button>
  )
}

export function LlmSettingsForm({
  profiles,
  selectedProfileId,
  provider,
  pipeline,
  lang,
  action,
}: LlmSettingsFormProps) {
  const resolvedLang = resolveLang(lang)
  const router = useRouter()
  const [state, formAction] = useActionState(action, IDLE_FORM_ACTION_RESULT)
  const [settingsName, setSettingsName] = useState(provider.settingsName)
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl)
  const [apiKey, setApiKey] = useState("")
  const [model, setModel] = useState(provider.model)
  const [isActive, setIsActive] = useState(provider.isActive)
  const [translationTitlePrompt, setTranslationTitlePrompt] = useState(
    pipeline.translationTitlePrompt,
  )
  const [translationContentPrompt, setTranslationContentPrompt] = useState(
    pipeline.translationContentPrompt,
  )
  const [summaryPromptEn, setSummaryPromptEn] = useState(pipeline.summaryPromptEn)
  const [summaryPromptZh, setSummaryPromptZh] = useState(pipeline.summaryPromptZh)
  const [tagPrompt, setTagPrompt] = useState(pipeline.tagPrompt)
  const [relevancePrompt, setRelevancePrompt] = useState(pipeline.relevancePrompt)
  const [modelOptions, setModelOptions] = useState(
    provider.model ? [provider.model] : [],
  )
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [modelFeedback, setModelFeedback] = useState("")
  const mergedModelOptions = useMemo(
    () => mergeModelOptions(model, modelOptions),
    [model, modelOptions],
  )

  useEffect(() => {
    setSettingsName(provider.settingsName)
    setBaseUrl(provider.baseUrl)
    setApiKey("")
    setModel(provider.model)
    setIsActive(provider.isActive)
    setTranslationTitlePrompt(pipeline.translationTitlePrompt)
    setTranslationContentPrompt(pipeline.translationContentPrompt)
    setSummaryPromptEn(pipeline.summaryPromptEn)
    setSummaryPromptZh(pipeline.summaryPromptZh)
    setTagPrompt(pipeline.tagPrompt)
    setRelevancePrompt(pipeline.relevancePrompt)
    setModelOptions(provider.model ? [provider.model] : [])
    setModelFeedback("")
  }, [
    provider.id,
    provider.settingsName,
    provider.baseUrl,
    provider.model,
    provider.isActive,
    pipeline.translationTitlePrompt,
    pipeline.translationContentPrompt,
    pipeline.summaryPromptEn,
    pipeline.summaryPromptZh,
    pipeline.tagPrompt,
    pipeline.relevancePrompt,
  ])

  async function loadProviderModels() {
    setIsLoadingModels(true)
    setModelFeedback("")

    try {
      const response = await fetch("/api/admin/provider-models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: provider.id, baseUrl, apiKey, lang }),
      })
      const payload = (await response.json()) as {
        ok: boolean
        message?: string
        models?: string[]
      }

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.message ||
            (resolvedLang === "zh"
              ? "获取模型失败。"
              : "Failed to load models."),
        )
      }

      const nextOptions = mergeModelOptions(model, payload.models ?? [])
      setModelOptions(nextOptions)

      if (!model && nextOptions.length > 0) {
        setModel(nextOptions[0])
      }

      setModelFeedback(
        resolvedLang === "zh"
          ? `已获取 ${nextOptions.length} 个模型。`
          : `Loaded ${nextOptions.length} models.`,
      )
    } catch (error) {
      setModelFeedback(
        error instanceof Error
          ? error.message
          : resolvedLang === "zh"
            ? "获取模型失败。"
            : "Failed to load models.",
      )
    } finally {
      setIsLoadingModels(false)
    }
  }

  return (
    <div key={provider.id || "new-provider"} className="flex flex-col gap-6">
      {/* Profile selector */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedProfileId ?? ""}
          onChange={(event) => {
            const value = event.target.value
            if (value === "new") {
              router.push(`/${lang}/admin/settings?profile=new`)
            } else if (value) {
              router.push(`/${lang}/admin/settings?profile=${value}`)
            }
          }}
          className={cn(getAdminSelectClassName(), "min-w-[180px]")}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
          <option value="new">
            {resolvedLang === "zh" ? "＋ 新建配置" : "＋ New profile"}
          </option>
        </select>
        <p className="text-sm text-muted-foreground">
          {model} · {baseUrl.replace(/^https?:\/\//, "").split("/")[0]}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {isActive ? (
            <Badge
              variant="outline"
              className="border-emerald-900/18 bg-[#f7fbf8] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100"
            >
              <Check className="mr-1 size-3" />
              {resolvedLang === "zh" ? "当前生效" : "Active"}
            </Badge>
          ) : (
            <form action={activateLlmSettingsAction}>
              <input type="hidden" name="id" value={provider.id} />
              <input type="hidden" name="lang" value={lang} />
              <Button type="submit" variant="outline" size="sm">
                {resolvedLang === "zh" ? "设为生效" : "Activate"}
              </Button>
            </form>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${lang}/admin/settings?profile=new`)}
          >
            <PlusCircle className="mr-1.5 size-3.5" />
            {resolvedLang === "zh" ? "新建" : "New"}
          </Button>
          {provider.id && profiles.length > 1 ? (
            <form action={deleteLlmSettingsAction}>
              <input type="hidden" name="id" value={provider.id} />
              <input type="hidden" name="lang" value={lang} />
              <Button type="submit" variant="outline" size="sm">
                <Trash2 className="mr-1.5 size-3.5" />
                {resolvedLang === "zh" ? "删除" : "Delete"}
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <form action={formAction}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="id" value={provider.id} />
        <input type="hidden" name="isActive" value={isActive ? "on" : ""} />

        {/* Model config */}
        <Card>
          <CardHeader>
            <CardTitle>
              {resolvedLang === "zh" ? "模型配置" : "Model config"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="settings-name" className="text-sm font-medium">
                  {resolvedLang === "zh" ? "配置名称" : "Profile name"}
                </label>
                <Input
                  id="settings-name"
                  name="name"
                  value={settingsName}
                  onChange={(event) => setSettingsName(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="base-url" className="text-sm font-medium">
                  {resolvedLang === "zh" ? "服务地址" : "Endpoint"}
                </label>
                <Input
                  id="base-url"
                  name="baseUrl"
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="api-key" className="text-sm font-medium">
                  {resolvedLang === "zh" ? "API 密钥" : "API key"}
                </label>
                <Input
                  id="api-key"
                  name="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={
                    provider.hasStoredApiKey
                      ? resolvedLang === "zh"
                        ? "密钥已保存，输入新密钥可轮换"
                        : "Key stored. Enter a new key to rotate."
                      : "sk-..."
                  }
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="model" className="text-sm font-medium">
                  {resolvedLang === "zh" ? "默认模型" : "Default model"}
                </label>
                <div className="flex items-center gap-2">
                  {mergedModelOptions.length > 0 ? (
                    <select
                      id="model"
                      name="model"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      className={cn(getAdminSelectClassName(), "flex-1")}
                    >
                      {mergedModelOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="model"
                      name="model"
                      value={model}
                      onChange={(event) => setModel(event.target.value)}
                      className="flex-1"
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadProviderModels}
                    disabled={isLoadingModels}
                  >
                    {isLoadingModels
                      ? resolvedLang === "zh"
                        ? "获取中..."
                        : "Loading..."
                      : resolvedLang === "zh"
                        ? "获取模型"
                        : "Fetch models"}
                  </Button>
                </div>
                {modelFeedback ? (
                  <p className="text-sm text-muted-foreground">{modelFeedback}</p>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline prompts */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {resolvedLang === "zh" ? "处理链路" : "Pipeline"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <CollapsiblePromptField
                id="relevance-prompt"
                name="relevancePrompt"
                label={resolvedLang === "zh" ? "相关性判断" : "Classify relevance"}
                value={relevancePrompt}
                onChange={setRelevancePrompt}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="title-prompt"
                name="translateTitlePrompt"
                label={resolvedLang === "zh" ? "标题翻译" : "Translate title"}
                value={translationTitlePrompt}
                onChange={setTranslationTitlePrompt}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="content-prompt"
                name="translateContentPrompt"
                label={resolvedLang === "zh" ? "正文翻译" : "Translate body"}
                value={translationContentPrompt}
                onChange={setTranslationContentPrompt}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="summary-prompt-en"
                name="summaryPromptEn"
                label={resolvedLang === "zh" ? "英文摘要" : "English summary"}
                value={summaryPromptEn}
                onChange={setSummaryPromptEn}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="summary-prompt-zh"
                name="summaryPromptZh"
                label={resolvedLang === "zh" ? "中文摘要" : "Chinese summary"}
                value={summaryPromptZh}
                onChange={setSummaryPromptZh}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="tag-prompt"
                name="tagPrompt"
                label={resolvedLang === "zh" ? "标签提取" : "Generate tags"}
                value={tagPrompt}
                onChange={setTagPrompt}
                lang={resolvedLang}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <FeedbackMessage state={state} />
            <div className="ml-auto">
              <SubmitButton
                idleLabel={resolvedLang === "zh" ? "保存配置" : "Save"}
                pendingLabel={
                  resolvedLang === "zh" ? "保存中..." : "Saving..."
                }
              />
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
