"use client"

import { useActionState, useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, ChevronRight, PlusCircle, Trash2 } from "lucide-react"
import { CustomSelect } from "@/components/ui/custom-select"

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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  IDLE_FORM_ACTION_RESULT,
  type FormActionResult,
} from "@/lib/action-result"
import {
  activateLlmSettingsAction,
  deleteLlmSettingsAction,
  testLlmSettingsAction,
} from "@/lib/actions/settings"
import type { AppLang } from "@/lib/i18n"
import { resolveLang } from "@/lib/i18n"
import { mergeModelOptions } from "@/lib/provider-models"
import { PROVIDER_PRESETS, resolvePresetLabel } from "@/lib/provider-presets"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Reducer: consolidates 15+ useState into a single state machine
// ---------------------------------------------------------------------------

interface FormState {
  settingsName: string
  baseUrl: string
  apiKey: string
  model: string
  isActive: boolean
  translationTitlePrompt: string
  translationContentPrompt: string
  summaryPromptEn: string
  summaryPromptZh: string
  tagPrompt: string
  relevancePrompt: string
  modelOptions: string[]
  isLoadingModels: boolean
  modelFeedback: string
  selectedPresetIndex: number
  nameManuallyEdited: boolean
}

type FormAction =
  | { type: "SET_FIELD"; field: keyof FormState; value: string | boolean | number | string[] }
  | { type: "APPLY_PRESET"; presetIndex: number }
  | { type: "SYNC_PROVIDER"; provider: ProviderSettings; pipeline: PipelineSettings }
  | { type: "MODELS_LOADED"; options: string[]; feedback: string }
  | { type: "MODELS_ERROR"; feedback: string }
  | { type: "START_LOADING_MODELS" }
  | { type: "RESET_PIPELINE"; pipeline: PipelineSettings }
  | { type: "CLEAR_MODEL_LIST" }

function initFormState(provider: ProviderSettings, pipeline: PipelineSettings, presetIndex?: number): FormState {
  const matchedIdx = provider.baseUrl
    ? PROVIDER_PRESETS.findIndex((p) => p.baseUrl === provider.baseUrl)
    : -1
  return {
    settingsName: provider.settingsName,
    baseUrl: provider.baseUrl,
    apiKey: "",
    model: provider.model,
    isActive: provider.isActive,
    translationTitlePrompt: pipeline.translationTitlePrompt,
    translationContentPrompt: pipeline.translationContentPrompt,
    summaryPromptEn: pipeline.summaryPromptEn,
    summaryPromptZh: pipeline.summaryPromptZh,
    tagPrompt: pipeline.tagPrompt,
    relevancePrompt: pipeline.relevancePrompt,
    modelOptions: [],
    isLoadingModels: false,
    modelFeedback: "",
    selectedPresetIndex: presetIndex != null && presetIndex >= 0 && presetIndex < PROVIDER_PRESETS.length
      ? presetIndex
      : matchedIdx >= 0 ? matchedIdx : PROVIDER_PRESETS.length - 1,
    nameManuallyEdited: false,
  }
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value }
    case "APPLY_PRESET": {
      const preset = PROVIDER_PRESETS[action.presetIndex]
      if (!preset) return state
      return {
        ...state,
        selectedPresetIndex: action.presetIndex,
        baseUrl: preset.baseUrl,
        settingsName: state.nameManuallyEdited ? state.settingsName : preset.name,
        nameManuallyEdited: false,
        model: "",
        modelOptions: [],
        modelFeedback: "",
        apiKey: "",
      }
    }
    case "SYNC_PROVIDER":
      return initFormState(action.provider, action.pipeline)
    case "MODELS_LOADED": {
      const nextModel = !state.model && action.options.length > 0 ? action.options[0] : state.model
      return {
        ...state,
        model: nextModel,
        modelOptions: action.options,
        isLoadingModels: false,
        modelFeedback: action.feedback,
      }
    }
    case "MODELS_ERROR":
      return { ...state, isLoadingModels: false, modelFeedback: action.feedback }
    case "START_LOADING_MODELS":
      return { ...state, isLoadingModels: true, modelFeedback: "" }
    case "RESET_PIPELINE":
      return {
        ...state,
        relevancePrompt: action.pipeline.relevancePrompt,
        translationTitlePrompt: action.pipeline.translationTitlePrompt,
        translationContentPrompt: action.pipeline.translationContentPrompt,
        summaryPromptEn: action.pipeline.summaryPromptEn,
        summaryPromptZh: action.pipeline.summaryPromptZh,
        tagPrompt: action.pipeline.tagPrompt,
      }
    case "CLEAR_MODEL_LIST":
      return { ...state, modelOptions: [], modelFeedback: "" }
  }
}

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
  presetIndex?: number
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
  presetIndex,
  provider,
  pipeline,
  lang,
  action,
}: LlmSettingsFormProps) {
  const resolvedLang = resolveLang(lang)
  const router = useRouter()
  const [state, formAction] = useActionState(action, IDLE_FORM_ACTION_RESULT)
  const [form, dispatch] = useReducer(formReducer, { provider, pipeline, presetIndex }, ({ provider: p, pipeline: pl, presetIndex: pi }) => initFormState(p, pl, pi))
  const [isActionPending, startActionTransition] = useTransition()
  const mergedModelOptions = useMemo(
    () => mergeModelOptions(form.model, form.modelOptions),
    [form.model, form.modelOptions],
  )

  // Sync from preset query param (new profile from preset link)
  useEffect(() => {
    if (presetIndex != null && presetIndex >= 0 && presetIndex < PROVIDER_PRESETS.length) {
      dispatch({ type: "APPLY_PRESET", presetIndex })
    }
  }, [presetIndex])

  // Sync from server data (provider/pipeline changed)
  useEffect(() => {
    dispatch({ type: "SYNC_PROVIDER", provider, pipeline })
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

  const abortControllerRef = useRef<AbortController | null>(null)

  async function loadProviderModels() {
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    dispatch({ type: "START_LOADING_MODELS" })

    try {
      const response = await fetch("/api/admin/provider-models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profileId: provider.id, baseUrl: form.baseUrl, apiKey: form.apiKey, lang }),
        signal: controller.signal,
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

      const nextOptions = mergeModelOptions(form.model, payload.models ?? [])
      dispatch({
        type: "MODELS_LOADED",
        options: nextOptions,
        feedback: resolvedLang === "zh"
          ? `已获取 ${nextOptions.length} 个模型。`
          : `Loaded ${nextOptions.length} models.`,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      dispatch({
        type: "MODELS_ERROR",
        feedback: error instanceof Error
          ? error.message
          : resolvedLang === "zh"
            ? "获取模型失败。"
            : "Failed to load models.",
      })
    }
  }

  function resetPipelineDraft() {
    dispatch({ type: "RESET_PIPELINE", pipeline })
  }

  return (
    <div key={provider.id || "new-provider"} className="flex flex-col gap-6">
      <form action={formAction}>
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="id" value={provider.id} />

        <Tabs defaultValue="provider">
          <div className="flex items-center gap-3">
            <TabsList>
              <TabsTrigger value="provider">
                {resolvedLang === "zh" ? "模型配置" : "Model config"}
              </TabsTrigger>
              <TabsTrigger value="pipeline">
                {resolvedLang === "zh" ? "处理链路" : "Pipeline"}
              </TabsTrigger>
            </TabsList>
            {profiles.length > 0 ? (
              <div className="ml-auto flex items-center gap-2">
                <label className="text-sm text-muted-foreground">
                  {resolvedLang === "zh" ? "生效配置：" : "Active config:"}
                </label>
                <CustomSelect
                  className="min-w-[220px]"
                  value={profiles.find((p) => p.isActive)?.id ?? ""}
                  onChange={(targetId) => {
                    if (!targetId) return
                    startActionTransition(async () => {
                      const fd = new FormData()
                      fd.set("id", targetId)
                      fd.set("lang", String(lang))
                      await activateLlmSettingsAction(fd)
                      router.refresh()
                    })
                  }}
                  disabled={isActionPending}
                  options={profiles.map((p) => ({
                    value: p.id,
                    label: `${p.name} (${p.model})`,
                  }))}
                />
              </div>
            ) : null}
          </div>

          <TabsContent value="provider" keepMounted>
            <Card>
              <CardHeader>
                <CardTitle>
                  {provider.settingsName.trim() || provider.providerName}
                </CardTitle>
                <CardDescription>
                  {resolvedLang === "zh"
                    ? "维护模型服务凭证、默认模型和启用状态。"
                    : "Manage model service credentials, the default model, and active state."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <CustomSelect
                    value={selectedProfileId ?? ""}
                    onChange={(value) => {
                      if (value === "new") {
                        router.push(`/${lang}/admin/settings?profile=new`)
                      } else if (value) {
                        router.push(`/${lang}/admin/settings?profile=${value}`)
                      }
                    }}
                    className="min-w-[180px]"
                    options={[
                      ...profiles.map((profile) => ({
                        value: profile.id,
                        label: profile.name,
                      })),
                      {
                        value: "new",
                        label: resolvedLang === "zh" ? "＋ 新建配置" : "＋ New profile",
                      },
                    ]}
                  />
                  <div className="ml-auto flex items-center gap-2">
                    {form.isActive ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-900/18 bg-[#f7fbf8] text-emerald-950 dark:border-emerald-200/14 dark:bg-[#121b17] dark:text-emerald-100"
                      >
                        <Check className="mr-1 size-3" />
                        {resolvedLang === "zh" ? "当前生效" : "Active"}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isActionPending}
                        onClick={() => {
                          startActionTransition(async () => {
                            const fd = new FormData()
                            fd.set("id", provider.id)
                            fd.set("lang", String(lang))
                            await activateLlmSettingsAction(fd)
                            router.refresh()
                          })
                        }}
                      >
                        {resolvedLang === "zh" ? "设为生效" : "Activate"}
                      </Button>
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
                    {provider.id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isActionPending}
                        onClick={() => {
                          startActionTransition(async () => {
                            const fd = new FormData()
                            fd.set("id", provider.id)
                            fd.set("lang", String(lang))
                            await testLlmSettingsAction(fd)
                          })
                        }}
                      >
                        {isActionPending
                          ? (resolvedLang === "zh" ? "测试中..." : "Testing...")
                          : (resolvedLang === "zh" ? "测试连接" : "Test")}
                      </Button>
                    ) : null}
                    {provider.id && profiles.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isActionPending}
                        onClick={() => {
                          const confirmed = window.confirm(
                            resolvedLang === "zh"
                              ? `确定要删除配置「${provider.settingsName}」吗？`
                              : `Delete profile "${provider.settingsName}"?`,
                          )
                          if (!confirmed) return
                          startActionTransition(async () => {
                            const fd = new FormData()
                            fd.set("id", provider.id)
                            fd.set("lang", String(lang))
                            await deleteLlmSettingsAction(fd)
                            router.refresh()
                          })
                        }}
                      >
                        <Trash2 className="mr-1.5 size-3.5" />
                        {resolvedLang === "zh" ? "删除" : "Delete"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="settings-name" className="text-sm font-medium">
                    {resolvedLang === "zh" ? "配置名称" : "Profile name"}
                  </label>
                  <Input
                    id="settings-name"
                    name="name"
                    value={form.settingsName}
                    onChange={(event) => {
                      dispatch({ type: "SET_FIELD", field: "settingsName", value: event.target.value })
                      dispatch({ type: "SET_FIELD", field: "nameManuallyEdited", value: true })
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="provider-preset" className="text-sm font-medium">
                    {resolvedLang === "zh" ? "服务商预设" : "Provider preset"}
                  </label>
                  <CustomSelect
                    value={form.selectedPresetIndex >= 0 && form.selectedPresetIndex < PROVIDER_PRESETS.length ? PROVIDER_PRESETS[form.selectedPresetIndex].baseUrl : ""}
                    onChange={(val) => {
                      const idx = PROVIDER_PRESETS.findIndex((p) => p.baseUrl === val)
                      if (idx < 0) return
                      const preset = PROVIDER_PRESETS[idx]
                      if (preset.baseUrl === "") return
                      if (provider.id) {
                        router.push(`/${lang}/admin/settings?profile=new&preset=${idx}`)
                        return
                      }
                      dispatch({ type: "APPLY_PRESET", presetIndex: idx })
                    }}
                    placeholder={resolvedLang === "zh" ? "选择预设以自动填充..." : "Select a preset to auto-fill..."}
                    options={PROVIDER_PRESETS.map((preset) => ({
                      value: preset.baseUrl,
                      label: resolvePresetLabel(preset, resolvedLang),
                    }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="base-url" className="text-sm font-medium">
                    {resolvedLang === "zh" ? "服务地址" : "Endpoint"}
                  </label>
                  <Input
                    id="base-url"
                    name="baseUrl"
                    value={form.baseUrl}
                    onChange={(event) => dispatch({ type: "SET_FIELD", field: "baseUrl", value: event.target.value })}
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
                    value={form.apiKey}
                    onChange={(event) => dispatch({ type: "SET_FIELD", field: "apiKey", value: event.target.value })}
                    placeholder={
                      provider.hasStoredApiKey
                        ? "● ● ● ● ● ● ● ● ● ● ● ●"
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
                    {resolvedLang === "zh" ? "模型" : "Model"}
                  </label>
                  {form.modelOptions.length > 0 ? (
                    <>
                      <input type="hidden" name="model" value={form.model} />
                      <CustomSelect
                        value={form.model}
                        onChange={(val) => dispatch({ type: "SET_FIELD", field: "model", value: val })}
                        options={mergedModelOptions.map((option) => ({
                          value: option,
                          label: option,
                        }))}
                      />
                    </>
                  ) : (
                    <Input
                      id="model"
                      name="model"
                      value={form.model}
                      onChange={(event) => dispatch({ type: "SET_FIELD", field: "model", value: event.target.value })}
                      placeholder={resolvedLang === "zh" ? "输入模型名称或点击获取模型列表" : "Enter model name or load model list"}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadProviderModels}
                      disabled={form.isLoadingModels}
                    >
                      {form.isLoadingModels
                        ? resolvedLang === "zh"
                          ? "获取模型中..."
                          : "Loading models..."
                        : resolvedLang === "zh"
                          ? "获取模型列表"
                          : "Load model list"}
                    </Button>
                    {form.modelOptions.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => dispatch({ type: "CLEAR_MODEL_LIST" })}
                      >
                        {resolvedLang === "zh" ? "清除列表" : "Clear list"}
                      </Button>
                    ) : null}
                  </div>
                  {form.modelFeedback ? (
                    <p className="text-sm text-muted-foreground">{form.modelFeedback}</p>
                  ) : null}
                </div>
                <div className={cn("flex items-center justify-between gap-4 rounded-[1.15rem] border border-black/5 bg-white/58 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-none")}>
                  <label htmlFor="is-active-checkbox" className="flex flex-col gap-1">
                    <p className="text-sm font-medium">
                      {resolvedLang === "zh" ? "设为当前生效配置" : "Set as active profile"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {resolvedLang === "zh"
                        ? "Worker 会优先读取这套配置来执行处理任务。"
                        : "The worker will prefer this profile when processing article jobs."}
                    </p>
                  </label>
                  <input
                    id="is-active-checkbox"
                    type="checkbox"
                    name="isActive"
                    checked={form.isActive}
                    onChange={(event) => dispatch({ type: "SET_FIELD", field: "isActive", value: event.target.checked })}
                    aria-label={resolvedLang === "zh" ? "设为当前生效配置" : "Set as active profile"}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" keepMounted>
            <Card>
              <CardContent className="pt-6">
                <div className="grid gap-3 md:grid-cols-2">
                  <CollapsiblePromptField
                    id="relevance-prompt"
                    name="relevancePrompt"
                    label={resolvedLang === "zh" ? "相关性判断" : "Classify relevance"}
                    value={form.relevancePrompt}
                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "relevancePrompt", value: v })}
                    lang={resolvedLang}
                  />
                  <CollapsiblePromptField
                    id="title-prompt"
                    name="translateTitlePrompt"
                    label={resolvedLang === "zh" ? "标题翻译" : "Translate title"}
                    value={form.translationTitlePrompt}
                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "translationTitlePrompt", value: v })}
                    lang={resolvedLang}
                  />
                  <CollapsiblePromptField
                    id="content-prompt"
                    name="translateContentPrompt"
                    label={resolvedLang === "zh" ? "正文翻译" : "Translate body"}
                    value={form.translationContentPrompt}
                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "translationContentPrompt", value: v })}
                    lang={resolvedLang}
                  />
                  <CollapsiblePromptField
                    id="summary-prompt-en"
                    name="summaryPromptEn"
                    label={resolvedLang === "zh" ? "英文摘要" : "English summary"}
                    value={form.summaryPromptEn}
                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "summaryPromptEn", value: v })}
                    lang={resolvedLang}
                  />
                  <CollapsiblePromptField
                    id="summary-prompt-zh"
                    name="summaryPromptZh"
                    label={resolvedLang === "zh" ? "中文摘要" : "Chinese summary"}
                    value={form.summaryPromptZh}
                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "summaryPromptZh", value: v })}
                    lang={resolvedLang}
                  />
                  <CollapsiblePromptField
                    id="tag-prompt"
                    name="tagPrompt"
                    label={resolvedLang === "zh" ? "标签提取" : "Generate tags"}
                    value={form.tagPrompt}
                    onChange={(v) => dispatch({ type: "SET_FIELD", field: "tagPrompt", value: v })}
                    lang={resolvedLang}
                  />
                </div>
                <div className="mt-3">
                  <Button variant="outline" type="button" size="sm" onClick={resetPipelineDraft}>
                    {resolvedLang === "zh" ? "重置草稿" : "Reset draft"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex items-center gap-3">
          <FeedbackMessage state={state} />
          <div className="ml-auto flex items-center gap-2">
            <SubmitButton
              idleLabel={resolvedLang === "zh" ? "保存配置" : "Save"}
              pendingLabel={resolvedLang === "zh" ? "保存中..." : "Saving..."}
            />
          </div>
        </div>
      </form>
    </div>
  )
}
