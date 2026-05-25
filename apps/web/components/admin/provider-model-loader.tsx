"use client";

import { useMemo, useRef } from "react";

import type {
  FormAction,
  FormState,
} from "@/components/admin/llm-settings-form-reducer";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Input } from "@/components/ui/input";
import type { AppLang } from "@/lib/i18n";
import { mergeModelOptions } from "@/lib/provider-models";

type ProviderModelLoaderProps = {
  form: FormState;
  profileId: string;
  lang: AppLang;
  onFieldChange: (field: keyof FormState, value: string | boolean | number | string[]) => void;
  onAction: (action: FormAction) => void;
};

export function ProviderModelLoader({
  form,
  profileId,
  lang,
  onFieldChange,
  onAction,
}: ProviderModelLoaderProps) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const mergedModelOptions = useMemo(
    () => mergeModelOptions(form.model, form.modelOptions),
    [form.model, form.modelOptions],
  );

  async function loadProviderModels() {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    onAction({ type: "START_LOADING_MODELS" });

    try {
      const response = await fetch("/api/admin/provider-models", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profileId,
          baseUrl: form.baseUrl,
          apiKey: form.apiKey,
          lang,
        }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        ok: boolean;
        message?: string;
        models?: string[];
      };

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.message ||
            (lang === "zh"
              ? "获取模型失败。"
              : "Failed to load models."),
        );
      }

      const nextOptions = mergeModelOptions(form.model, payload.models ?? []);
      onAction({
        type: "MODELS_LOADED",
        options: nextOptions,
        feedback:
          lang === "zh"
            ? `已获取 ${nextOptions.length} 个模型。`
            : `Loaded ${nextOptions.length} models.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      onAction({
        type: "MODELS_ERROR",
        feedback:
          error instanceof Error
            ? error.message
            : lang === "zh"
              ? "获取模型失败。"
              : "Failed to load models.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="model" className="text-sm font-medium">
        {lang === "zh" ? "模型" : "Model"}
      </label>
      {form.modelOptions.length > 0 ? (
        <>
          <input type="hidden" name="model" value={form.model} />
          <CustomSelect
            value={form.model}
            onChange={(val) => onFieldChange("model", val)}
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
          onChange={(event) => onFieldChange("model", event.target.value)}
          placeholder={
            lang === "zh"
              ? "输入模型名称或点击获取模型列表"
              : "Enter model name or load model list"
          }
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
            ? lang === "zh"
              ? "获取模型中..."
              : "Loading models..."
            : lang === "zh"
              ? "获取模型列表"
              : "Load model list"}
        </Button>
        {form.modelOptions.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => onAction({ type: "CLEAR_MODEL_LIST" })}
          >
            {lang === "zh" ? "清除列表" : "Clear list"}
          </Button>
        ) : null}
      </div>
      {form.modelFeedback ? (
        <p className="text-sm text-muted-foreground">
          {form.modelFeedback}
        </p>
      ) : null}
    </div>
  );
}
