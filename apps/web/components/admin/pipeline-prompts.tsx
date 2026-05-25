"use client";

import type { FormState } from "@/components/admin/llm-settings-form-reducer";
import {
  CollapsiblePromptField,
} from "@/components/admin/llm-settings-form-parts";
import { Button } from "@/components/ui/button";
import type { AppLang } from "@/lib/i18n";

type PipelinePromptsProps = {
  form: FormState;
  lang: AppLang;
  onFieldChange: (field: keyof FormState, value: string | boolean | number | string[]) => void;
  onResetPipeline: () => void;
};

export function PipelinePrompts({
  form,
  lang,
  onFieldChange,
  onResetPipeline,
}: PipelinePromptsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CollapsiblePromptField
        id="relevance-prompt"
        name="relevancePrompt"
        label={
          lang === "zh"
            ? "相关性判断"
            : "Classify relevance"
        }
        value={form.relevancePrompt}
        onChange={(v) => onFieldChange("relevancePrompt", v)}
        lang={lang}
      />
      <CollapsiblePromptField
        id="title-prompt"
        name="translateTitlePrompt"
        label={
          lang === "zh" ? "标题翻译" : "Translate title"
        }
        value={form.translationTitlePrompt}
        onChange={(v) => onFieldChange("translationTitlePrompt", v)}
        lang={lang}
      />
      <CollapsiblePromptField
        id="content-prompt"
        name="translateContentPrompt"
        label={
          lang === "zh" ? "正文翻译" : "Translate body"
        }
        value={form.translationContentPrompt}
        onChange={(v) => onFieldChange("translationContentPrompt", v)}
        lang={lang}
      />
      <CollapsiblePromptField
        id="summary-prompt-en"
        name="summaryPromptEn"
        label={
          lang === "zh" ? "英文摘要" : "English summary"
        }
        value={form.summaryPromptEn}
        onChange={(v) => onFieldChange("summaryPromptEn", v)}
        lang={lang}
      />
      <CollapsiblePromptField
        id="summary-prompt-zh"
        name="summaryPromptZh"
        label={
          lang === "zh" ? "中文摘要" : "Chinese summary"
        }
        value={form.summaryPromptZh}
        onChange={(v) => onFieldChange("summaryPromptZh", v)}
        lang={lang}
      />
      <CollapsiblePromptField
        id="tag-prompt"
        name="tagPrompt"
        label={lang === "zh" ? "标签提取" : "Generate tags"}
        value={form.tagPrompt}
        onChange={(v) => onFieldChange("tagPrompt", v)}
        lang={lang}
      />
    </div>
  );
}
