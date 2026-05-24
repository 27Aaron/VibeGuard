import type {
  PipelineSettings,
  ProviderSettings,
} from "@/components/admin/types";
import { PROVIDER_PRESETS } from "@/lib/provider-presets";

// ---------------------------------------------------------------------------
// Reducer：将原本分散的 15+ 个 useState 整合为统一的状态机，
// 集中管理表单字段、模型列表加载、预设应用等所有状态变更逻辑。
// ---------------------------------------------------------------------------

export interface FormState {
  settingsName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive: boolean;
  translationTitlePrompt: string;
  translationContentPrompt: string;
  summaryPromptEn: string;
  summaryPromptZh: string;
  tagPrompt: string;
  relevancePrompt: string;
  modelOptions: string[];
  isLoadingModels: boolean;
  modelFeedback: string;
  selectedPresetIndex: number;
  nameManuallyEdited: boolean;
}

export type FormAction =
  | {
      type: "SET_FIELD";
      field: keyof FormState;
      value: string | boolean | number | string[];
    }
  | { type: "APPLY_PRESET"; presetIndex: number }
  | {
      type: "SYNC_PROVIDER";
      provider: ProviderSettings;
      pipeline: PipelineSettings;
    }
  | { type: "MODELS_LOADED"; options: string[]; feedback: string }
  | { type: "MODELS_ERROR"; feedback: string }
  | { type: "START_LOADING_MODELS" }
  | { type: "RESET_PIPELINE"; pipeline: PipelineSettings }
  | { type: "CLEAR_MODEL_LIST" };

export function initFormState(
  provider: ProviderSettings,
  pipeline: PipelineSettings,
  presetIndex?: number,
): FormState {
  const matchedIdx = provider.baseUrl
    ? PROVIDER_PRESETS.findIndex((p) => p.baseUrl === provider.baseUrl)
    : -1;
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
    selectedPresetIndex:
      presetIndex != null &&
      presetIndex >= 0 &&
      presetIndex < PROVIDER_PRESETS.length
        ? presetIndex
        : matchedIdx >= 0
          ? matchedIdx
          : PROVIDER_PRESETS.length - 1,
    nameManuallyEdited: false,
  };
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "APPLY_PRESET": {
      const preset = PROVIDER_PRESETS[action.presetIndex];
      if (!preset) return state;
      return {
        ...state,
        selectedPresetIndex: action.presetIndex,
        baseUrl: preset.baseUrl,
        settingsName: state.nameManuallyEdited
          ? state.settingsName
          : preset.name,
        nameManuallyEdited: false,
        model: "",
        modelOptions: [],
        modelFeedback: "",
        apiKey: "",
      };
    }
    case "SYNC_PROVIDER":
      return initFormState(action.provider, action.pipeline);
    case "MODELS_LOADED": {
      const nextModel =
        !state.model && action.options.length > 0
          ? action.options[0]
          : state.model;
      return {
        ...state,
        model: nextModel,
        modelOptions: action.options,
        isLoadingModels: false,
        modelFeedback: action.feedback,
      };
    }
    case "MODELS_ERROR":
      return {
        ...state,
        isLoadingModels: false,
        modelFeedback: action.feedback,
      };
    case "START_LOADING_MODELS":
      return { ...state, isLoadingModels: true, modelFeedback: "" };
    case "RESET_PIPELINE":
      return {
        ...state,
        relevancePrompt: action.pipeline.relevancePrompt,
        translationTitlePrompt: action.pipeline.translationTitlePrompt,
        translationContentPrompt: action.pipeline.translationContentPrompt,
        summaryPromptEn: action.pipeline.summaryPromptEn,
        summaryPromptZh: action.pipeline.summaryPromptZh,
        tagPrompt: action.pipeline.tagPrompt,
      };
    case "CLEAR_MODEL_LIST":
      return { ...state, modelOptions: [], modelFeedback: "" };
  }
}
