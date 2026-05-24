export function resolveSavedActiveFlag(input: {
  requestedIsActive: boolean;
  currentId: string;
  activeRowId?: string;
}) {
  if (input.requestedIsActive) {
    return true;
  }

  if (!input.activeRowId) {
    return true;
  }

  return input.activeRowId === input.currentId;
}

export function resolveStoredApiKey(input: {
  apiKey: string;
  existingApiKeyEncrypted?: string;
}) {
  const trimmedApiKey = input.apiKey.trim();

  if (trimmedApiKey) {
    return {
      apiKeyToEncrypt: trimmedApiKey,
      reusedExisting: false,
    };
  }

  if (input.existingApiKeyEncrypted) {
    return {
      apiKeyToEncrypt: null,
      reusedExisting: true,
    };
  }

  throw new Error("新建模型配置时必须填写 API Key。");
}

export function resolveSettingsSuccessMessage() {
  return "配置已保存。";
}
