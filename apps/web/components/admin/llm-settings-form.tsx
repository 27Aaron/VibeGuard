"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { useFormStatus } from "react-dom"
import { ChevronDown, ChevronRight } from "lucide-react"

import type {
  PipelineSettings,
  ProviderSettings,
} from "@/components/admin/types"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  IDLE_FORM_ACTION_RESULT,
  type FormActionResult,
} from "@/lib/action-result"
import { getAdminSelectClassName, getAdminSubtlePanelClassName } from "@/lib/admin-layout"
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
    <div className="flex flex-col gap-2">
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
  provider,
  pipeline,
  lang,
  action,
}: LlmSettingsFormProps) {
  const resolvedLang = resolveLang(lang)
  const providerCardTitle =
    provider.settingsName.trim() || provider.providerName
  const [activeTab, setActiveTab] = useState<"provider" | "pipeline">("provider")
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
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          profileId: provider.id,
          baseUrl,
          apiKey,
          lang,
        }),
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
              ? "获取模型列表失败。"
              : "Failed to load the model list."),
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
            ? "获取模型列表失败。"
            : "Failed to load the model list.",
      )
    } finally {
      setIsLoadingModels(false)
    }
  }

  function resetPipelineDraft() {
    setRelevancePrompt(pipeline.relevancePrompt)
    setTranslationTitlePrompt(pipeline.translationTitlePrompt)
    setTranslationContentPrompt(pipeline.translationContentPrompt)
    setSummaryPromptEn(pipeline.summaryPromptEn)
    setSummaryPromptZh(pipeline.summaryPromptZh)
    setTagPrompt(pipeline.tagPrompt)
  }

  return (
    <Tabs
      key={provider.id || "new-provider"}
      value={activeTab}
      onValueChange={(value) =>
        setActiveTab(value === "pipeline" ? "pipeline" : "provider")
      }
      className="gap-4"
    >
      <TabsList>
        <TabsTrigger value="provider">
          {resolvedLang === "zh" ? "模型服务配置" : "Model service"}
        </TabsTrigger>
        <TabsTrigger value="pipeline">
          {resolvedLang === "zh" ? "处理链路" : "Pipeline"}
        </TabsTrigger>
      </TabsList>
      {activeTab === "provider" ? (
      <TabsContent value="provider">
        <form action={formAction}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="formKind" value="provider" />
          <input type="hidden" name="id" value={provider.id} />
          <input
            type="hidden"
            name="translateTitlePrompt"
            value={translationTitlePrompt}
          />
          <input
            type="hidden"
            name="translateContentPrompt"
            value={translationContentPrompt}
          />
          <input
            type="hidden"
            name="summaryPromptEn"
            value={summaryPromptEn}
          />
          <input
            type="hidden"
            name="summaryPromptZh"
            value={summaryPromptZh}
          />
          <input
            type="hidden"
            name="tagPrompt"
            value={tagPrompt}
          />
          <input
            type="hidden"
            name="relevancePrompt"
            value={relevancePrompt}
          />
          <Card>
            <CardHeader>
              <CardTitle>{providerCardTitle}</CardTitle>
              <CardDescription>
                {resolvedLang === "zh"
                  ? "在一个地方维护模型服务凭证、默认模型和启用状态。"
                  : "Manage model service credentials, the default model, and active state in one place."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
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
                  {resolvedLang === "zh" ? "模型服务地址" : "Service base URL"}
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
                        ? "密钥已安全保存。输入新密钥可完成轮换。"
                        : "A key is already stored securely. Enter a new key to rotate it."
                      : "sk-..."
                  }
                />
                {provider.hasStoredApiKey ? (
                  <p className="text-sm text-muted-foreground">
                    {resolvedLang === "zh"
                      ? "当前已经保存过密钥。留空即可继续使用现有凭证。"
                      : "A key is already stored. Leave this empty to keep using the existing credentials."}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="model" className="text-sm font-medium">
                  {resolvedLang === "zh" ? "默认模型" : "Default model"}
                </label>
                {mergedModelOptions.length > 0 ? (
                  <select
                    id="model"
                    name="model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className={getAdminSelectClassName()}
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
                  />
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadProviderModels}
                    disabled={isLoadingModels}
                  >
                    {isLoadingModels
                      ? resolvedLang === "zh"
                        ? "获取模型中..."
                        : "Loading models..."
                      : resolvedLang === "zh"
                        ? "获取模型列表"
                        : "Load model list"}
                  </Button>
                </div>
                {modelFeedback ? (
                  <p className="text-sm text-muted-foreground">{modelFeedback}</p>
                ) : null}
              </div>
              <Separator />
              <div className={cn("flex items-center justify-between gap-4", getAdminSubtlePanelClassName())}>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    {resolvedLang === "zh" ? "设为当前生效配置" : "Set as active profile"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {resolvedLang === "zh"
                      ? "Worker 会优先读取这套配置来执行处理任务。"
                      : "The worker will prefer this profile when processing article jobs."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  aria-label={resolvedLang === "zh" ? "设为当前生效配置" : "Set as active profile"}
                />
              </div>
              <FeedbackMessage state={state} />
            </CardContent>
            <CardFooter className="justify-end">
              <SubmitButton
                idleLabel={resolvedLang === "zh" ? "保存模型服务配置" : "Save model profile"}
                pendingLabel={
                  resolvedLang === "zh"
                    ? "保存模型服务配置中..."
                    : "Saving model profile..."
                }
              />
            </CardFooter>
          </Card>
        </form>
      </TabsContent>
      ) : null}
      {activeTab === "pipeline" ? (
      <TabsContent value="pipeline">
        <form action={formAction}>
          <input type="hidden" name="lang" value={lang} />
          <input type="hidden" name="formKind" value="pipeline" />
          <input type="hidden" name="id" value={provider.id} />
          <input type="hidden" name="name" value={provider.settingsName} />
          <input type="hidden" name="baseUrl" value={provider.baseUrl} />
          <input type="hidden" name="apiKey" value="" />
          <input type="hidden" name="model" value={provider.model} />
          <input
            type="hidden"
            name="isActive"
            value={provider.isActive ? "on" : ""}
          />
          <Card>
            <CardHeader>
              <CardTitle>{resolvedLang === "zh" ? "默认提示词" : "Default prompts"}</CardTitle>
              <CardDescription>
                {resolvedLang === "zh"
                  ? "保存可复用的翻译、双语摘要和短标签提示词。"
                  : "Save reusable translation, bilingual summary, and short-tag prompts."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CollapsiblePromptField
                id="relevance-prompt"
                name="relevancePrompt"
                label={resolvedLang === "zh" ? "内容相关性判断 Prompt" : "Content relevance prompt"}
                value={relevancePrompt}
                onChange={setRelevancePrompt}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="title-prompt"
                name="translateTitlePrompt"
                label={resolvedLang === "zh" ? "标题翻译 Prompt" : "Title translation prompt"}
                value={translationTitlePrompt}
                onChange={setTranslationTitlePrompt}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="system-prompt"
                name="translateContentPrompt"
                label={resolvedLang === "zh" ? "正文翻译 Prompt" : "Body translation prompt"}
                value={translationContentPrompt}
                onChange={setTranslationContentPrompt}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="summary-prompt-en"
                name="summaryPromptEn"
                label={resolvedLang === "zh" ? "英文摘要 Prompt" : "English summary prompt"}
                value={summaryPromptEn}
                onChange={setSummaryPromptEn}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="summary-prompt-zh"
                name="summaryPromptZh"
                label={resolvedLang === "zh" ? "中文摘要 Prompt" : "Chinese summary prompt"}
                value={summaryPromptZh}
                onChange={setSummaryPromptZh}
                lang={resolvedLang}
              />
              <CollapsiblePromptField
                id="tag-prompt"
                name="tagPrompt"
                label={resolvedLang === "zh" ? "Tag 提取 Prompt" : "Tag extraction prompt"}
                value={tagPrompt}
                onChange={setTagPrompt}
                lang={resolvedLang}
              />
              <FeedbackMessage state={state} />
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" type="button" onClick={resetPipelineDraft}>
                {resolvedLang === "zh" ? "重置草稿" : "Reset draft"}
              </Button>
              <SubmitButton
                idleLabel={resolvedLang === "zh" ? "保存处理链路配置" : "Save pipeline settings"}
                pendingLabel={
                  resolvedLang === "zh"
                    ? "保存处理链路配置中..."
                    : "Saving pipeline settings..."
                }
              />
            </CardFooter>
          </Card>
        </form>
      </TabsContent>
      ) : null}
    </Tabs>
  )
}
