"use client";

import {
  useActionState,
  useEffect,
  useReducer,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  PlusCircle,
  Trash2,
} from "lucide-react";
import { CustomSelect } from "@/components/ui/custom-select";

import type {
  LlmSettingsRow,
  PipelineSettings,
  ProviderSettings,
} from "@/components/admin/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  IDLE_FORM_ACTION_RESULT,
  type FormActionResult,
} from "@/lib/action-result";
import {
  activateLlmSettingsAction,
  deleteLlmSettingsAction,
  testLlmSettingsAction,
} from "@/lib/actions/settings";
import type { AppLang } from "@/lib/i18n";
import { resolveLang } from "@/lib/i18n";
import { PROVIDER_PRESETS, resolvePresetLabel } from "@/lib/provider-presets";
import { cn } from "@/lib/utils";

import {
  formReducer,
  initFormState,
} from "@/components/admin/llm-settings-form-reducer";
import {
  FeedbackMessage,
  SubmitButton,
} from "@/components/admin/llm-settings-form-parts";
import { PipelinePrompts } from "@/components/admin/pipeline-prompts";
import { ProfileActiveSwitcher } from "@/components/admin/profile-active-switcher";
import { ProviderModelLoader } from "@/components/admin/provider-model-loader";

type LlmSettingsFormProps = {
  profiles: LlmSettingsRow[];
  selectedProfileId?: string;
  presetIndex?: number;
  provider: ProviderSettings;
  pipeline: PipelineSettings;
  lang: AppLang;
  action: (
    previousState: FormActionResult,
    formData: FormData,
  ) => Promise<FormActionResult>;
};

export function LlmSettingsForm({
  profiles,
  selectedProfileId,
  presetIndex,
  provider,
  pipeline,
  lang,
  action,
}: LlmSettingsFormProps) {
  const resolvedLang = resolveLang(lang);
  const router = useRouter();
  const [state, formAction] = useActionState(action, IDLE_FORM_ACTION_RESULT);
  const [form, dispatch] = useReducer(
    formReducer,
    { provider, pipeline, presetIndex },
    ({ provider: p, pipeline: pl, presetIndex: pi }) =>
      initFormState(p, pl, pi),
  );
  const [isActionPending, startActionTransition] = useTransition();

  // 从 URL 的 preset 查询参数同步预设配置（用于从预设链接创建新配置的场景）
  useEffect(() => {
    if (
      presetIndex != null &&
      presetIndex >= 0 &&
      presetIndex < PROVIDER_PRESETS.length
    ) {
      dispatch({ type: "APPLY_PRESET", presetIndex });
    }
  }, [presetIndex]);

  // 从服务端数据同步（当 provider 或 pipeline 在外部被修改时，将最新数据推送到表单状态）
  useEffect(() => {
    dispatch({ type: "SYNC_PROVIDER", provider, pipeline });
  }, [
    provider,
    provider.id,
    provider.settingsName,
    provider.baseUrl,
    provider.model,
    provider.isActive,
    pipeline,
    pipeline.translationTitlePrompt,
    pipeline.translationContentPrompt,
    pipeline.summaryPromptEn,
    pipeline.summaryPromptZh,
    pipeline.tagPrompt,
    pipeline.relevancePrompt,
  ]);

  function resetPipelineDraft() {
    dispatch({ type: "RESET_PIPELINE", pipeline });
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
            <ProfileActiveSwitcher profiles={profiles} lang={resolvedLang} />
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
                        router.push(`/${lang}/admin/settings?profile=new`);
                      } else if (value) {
                        router.push(`/${lang}/admin/settings?profile=${value}`);
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
                        label:
                          resolvedLang === "zh"
                            ? "＋ 新建配置"
                            : "＋ New profile",
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
                            const fd = new FormData();
                            fd.set("id", provider.id);
                            fd.set("lang", String(lang));
                            await activateLlmSettingsAction(fd);
                            router.refresh();
                          });
                        }}
                      >
                        {resolvedLang === "zh" ? "设为生效" : "Activate"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/${lang}/admin/settings?profile=new`)
                      }
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
                            const fd = new FormData();
                            fd.set("id", provider.id);
                            fd.set("lang", String(lang));
                            await testLlmSettingsAction(fd);
                          });
                        }}
                      >
                        {isActionPending
                          ? resolvedLang === "zh"
                            ? "测试中..."
                            : "Testing..."
                          : resolvedLang === "zh"
                            ? "测试连接"
                            : "Test"}
                      </Button>
                    ) : null}
                    {provider.id && profiles.length > 1 ? (
                      <AlertDialog>
                        <AlertDialogTrigger
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium whitespace-nowrap hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                          disabled={isActionPending}
                        >
                          <Trash2 className="size-3.5" />
                          {resolvedLang === "zh" ? "删除" : "Delete"}
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {resolvedLang === "zh"
                                ? "删除确认"
                                : "Confirm deletion"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {resolvedLang === "zh"
                                ? `确定要删除配置「${provider.settingsName}」吗？此操作不可撤销。`
                                : `Delete profile "${provider.settingsName}"? This action cannot be undone.`}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>
                              {resolvedLang === "zh" ? "取消" : "Cancel"}
                            </AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => {
                                startActionTransition(async () => {
                                  const fd = new FormData();
                                  fd.set("id", provider.id);
                                  fd.set("lang", String(lang));
                                  await deleteLlmSettingsAction(fd);
                                  router.refresh();
                                });
                              }}
                            >
                              {resolvedLang === "zh" ? "删除" : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="settings-name"
                    className="text-sm font-medium"
                  >
                    {resolvedLang === "zh" ? "配置名称" : "Profile name"}
                  </label>
                  <Input
                    id="settings-name"
                    name="name"
                    value={form.settingsName}
                    onChange={(event) => {
                      dispatch({
                        type: "SET_FIELD",
                        field: "settingsName",
                        value: event.target.value,
                      });
                      dispatch({
                        type: "SET_FIELD",
                        field: "nameManuallyEdited",
                        value: true,
                      });
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="provider-preset"
                    className="text-sm font-medium"
                  >
                    {resolvedLang === "zh" ? "服务商预设" : "Provider preset"}
                  </label>
                  <CustomSelect
                    value={
                      form.selectedPresetIndex >= 0 &&
                      form.selectedPresetIndex < PROVIDER_PRESETS.length
                        ? PROVIDER_PRESETS[form.selectedPresetIndex].baseUrl
                        : ""
                    }
                    onChange={(val) => {
                      const idx = PROVIDER_PRESETS.findIndex(
                        (p) => p.baseUrl === val,
                      );
                      if (idx < 0) return;
                      const preset = PROVIDER_PRESETS[idx];
                      if (preset.baseUrl === "") return;
                      if (provider.id) {
                        router.push(
                          `/${lang}/admin/settings?profile=new&preset=${idx}`,
                        );
                        return;
                      }
                      dispatch({ type: "APPLY_PRESET", presetIndex: idx });
                    }}
                    placeholder={
                      resolvedLang === "zh"
                        ? "选择预设以自动填充..."
                        : "Select a preset to auto-fill..."
                    }
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
                    onChange={(event) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "baseUrl",
                        value: event.target.value,
                      })
                    }
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
                    onChange={(event) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "apiKey",
                        value: event.target.value,
                      })
                    }
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
                <ProviderModelLoader
                  form={form}
                  profileId={provider.id}
                  lang={resolvedLang}
                  onFieldChange={(field, value) =>
                    dispatch({ type: "SET_FIELD", field, value })
                  }
                  onAction={(action) => dispatch(action)}
                />
                <div
                  className={cn(
                    "flex items-center justify-between gap-4 rounded-[1.15rem] border border-black/5 bg-white/58 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-white/10 dark:bg-white/4 dark:shadow-none",
                  )}
                >
                  <label
                    htmlFor="is-active-checkbox"
                    className="flex flex-col gap-1"
                  >
                    <p className="text-sm font-medium">
                      {resolvedLang === "zh"
                        ? "设为当前生效配置"
                        : "Set as active profile"}
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
                    onChange={(event) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "isActive",
                        value: event.target.checked,
                      })
                    }
                    aria-label={
                      resolvedLang === "zh"
                        ? "设为当前生效配置"
                        : "Set as active profile"
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pipeline" keepMounted>
            <Card>
              <CardContent className="pt-6">
                <PipelinePrompts
                  form={form}
                  lang={resolvedLang}
                  onFieldChange={(field, value) =>
                    dispatch({ type: "SET_FIELD", field, value })
                  }
                  onResetPipeline={resetPipelineDraft}
                />
                <div className="mt-3">
                  <Button
                    variant="outline"
                    type="button"
                    size="sm"
                    onClick={resetPipelineDraft}
                  >
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
  );
}
