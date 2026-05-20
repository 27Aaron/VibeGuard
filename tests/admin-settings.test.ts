import { describe, expect, it } from "vitest"
import { decryptSecret, encryptSecret } from "@vibeguard/llm/credentials"

import {
  buildModelAvailabilityMessage,
  mergeModelOptions,
  normalizeProviderErrorMessage,
} from "../apps/web/lib/provider-models"
import { normalizeUserFacingError } from "../apps/web/lib/errors"
import {
  DEFAULT_TAG_PROMPT,
  DEFAULT_SUMMARY_PROMPT_EN,
  DEFAULT_SUMMARY_PROMPT_ZH,
  normalizeTagPrompt,
} from "../apps/web/lib/admin-data"
import {
  resolveSavedActiveFlag,
  resolveSettingsSuccessMessage,
  resolveStoredApiKey,
} from "../apps/web/lib/llm-settings"

describe("admin settings helpers", () => {
  describe("resolveSavedActiveFlag", () => {
    it("keeps the selected row active when the operator requests it", () => {
      expect(
        resolveSavedActiveFlag({
          requestedIsActive: true,
          currentId: "settings-1",
          activeRowId: "settings-2",
        }),
      ).toBe(true)
    })

    it("promotes the saved row when there is no active configuration yet", () => {
      expect(
        resolveSavedActiveFlag({
          requestedIsActive: false,
          currentId: "settings-1",
        }),
      ).toBe(true)
    })

    it("preserves the active flag for the current row when the checkbox is cleared", () => {
      expect(
        resolveSavedActiveFlag({
          requestedIsActive: false,
          currentId: "settings-1",
          activeRowId: "settings-1",
        }),
      ).toBe(true)
    })

    it("allows a non-active row to remain inactive when another active row exists", () => {
      expect(
        resolveSavedActiveFlag({
          requestedIsActive: false,
          currentId: "settings-1",
          activeRowId: "settings-2",
        }),
      ).toBe(false)
    })
  })

  describe("secret helpers", () => {
    it("round-trips encrypted secrets", () => {
      process.env.VIBEGUARD_SECRET = "test-secret"
      const ciphertext = encryptSecret("sk-test-123")

      expect(decryptSecret(ciphertext)).toBe("sk-test-123")
    })

    it("falls back to an empty string for corrupted payloads", () => {
      process.env.VIBEGUARD_SECRET = "test-secret"
      expect(decryptSecret("not-a-valid-payload")).toBe("")
    })

    it("falls back to an empty string when the auth tag is tampered with", () => {
      process.env.VIBEGUARD_SECRET = "test-secret"
      const ciphertext = encryptSecret("sk-test-123")
      const [iv, _tag, encrypted] = ciphertext.split(".")

      expect(
        decryptSecret([iv, "AAAAAAAAAAAAAAAAAAAAAA==", encrypted].join(".")),
      ).toBe("")
    })

    it("keeps the legacy secret name as a fallback", () => {
      delete process.env.VIBEGUARD_SECRET
      process.env.CONTENT_FOUNDATION_SECRET = "test-secret"
      const ciphertext = encryptSecret("sk-test-123")

      expect(decryptSecret(ciphertext)).toBe("sk-test-123")
    })

    it("fails fast when the encryption secret is missing", () => {
      delete process.env.VIBEGUARD_SECRET
      delete process.env.CONTENT_FOUNDATION_SECRET

      expect(() => encryptSecret("sk-test-123")).toThrow(
        "VIBEGUARD_SECRET is required",
      )
    })
  })

  describe("stored API key resolution", () => {
    it("reuses the existing encrypted key when no replacement is provided", () => {
      expect(
        resolveStoredApiKey({
          apiKey: "",
          existingApiKeyEncrypted: "ciphertext",
        }),
      ).toEqual({
        apiKeyToEncrypt: null,
        reusedExisting: true,
      })
    })

    it("accepts a replacement key when one is entered", () => {
      expect(
        resolveStoredApiKey({
          apiKey: " sk-new ",
          existingApiKeyEncrypted: "ciphertext",
        }),
      ).toEqual({
        apiKeyToEncrypt: "sk-new",
        reusedExisting: false,
      })
    })

    it("requires a key for new configurations", () => {
      expect(() =>
        resolveStoredApiKey({
          apiKey: "",
        }),
      ).toThrow("新建模型配置时必须填写 API Key。")
    })

    it("localizes missing-key errors for the english settings form", () => {
      expect(
        normalizeUserFacingError(
          new Error("新建模型配置时必须填写 API Key。"),
          "en",
        ),
      ).toBe("An API key is required when creating a new model profile.")
    })
  })

  describe("success message resolution", () => {
    it("returns the pipeline copy for pipeline form submissions", () => {
      expect(resolveSettingsSuccessMessage("pipeline")).toBe(
        "处理链路提示词已保存。",
      )
    })

    it("defaults to the provider copy for other form submissions", () => {
      expect(resolveSettingsSuccessMessage("provider")).toBe(
        "模型服务配置已保存。",
      )
      expect(resolveSettingsSuccessMessage("")).toBe("模型服务配置已保存。")
    })
  })

  describe("provider model helpers", () => {
    it("keeps the current model when the provider list does not include it", () => {
      expect(
        mergeModelOptions("MiMo-V2.5-Pro", ["gpt-4.1", "gpt-4o-mini"]),
      ).toEqual(["MiMo-V2.5-Pro", "gpt-4.1", "gpt-4o-mini"])
    })

    it("returns a softer success message when the provider does not list the model", () => {
      expect(
        buildModelAvailabilityMessage({
          profileName: "default-openai",
          model: "MiMo-V2.5-Pro",
          modelFound: false,
        }),
      ).toContain("/v1/models 未返回 MiMo-V2.5-Pro")
    })

    it("explains HTML 404 responses as a likely base url issue", () => {
      const message = normalizeProviderErrorMessage({
        error: new Error(
          "404 <html><head><title>404 Not Found</title></head><body><center><h1>404 Not Found</h1></center><hr><center>openresty</center></body></html>",
        ),
        baseUrl: "https://example.com/chat/completions",
        action: "testConnection",
      })

      expect(message).toContain("Base URL 填的不是 API 根地址")
      expect(message).toContain("https://example.com/v1")
    })
  })

  describe("summary prompt helpers", () => {
    it("exposes separate English and Chinese default summary prompts", () => {
      expect(DEFAULT_SUMMARY_PROMPT_EN).toContain("English")
      expect(DEFAULT_SUMMARY_PROMPT_ZH).toContain("Simplified Chinese")
      expect(DEFAULT_SUMMARY_PROMPT_EN).not.toBe(DEFAULT_SUMMARY_PROMPT_ZH)
    })
  })

  describe("tag prompt helpers", () => {
    it("falls back to the full configurable tag extraction prompt", () => {
      expect(normalizeTagPrompt("")).toBe(DEFAULT_TAG_PROMPT)
      expect(
        normalizeTagPrompt("Extract short supply-chain security tags as strict JSON."),
      ).toBe(DEFAULT_TAG_PROMPT)
    })
  })
})
