import { createHash } from "node:crypto";

import {
  JobPipelineStage,
} from "@vibeguard/shared";
import type { UsageResult } from "@vibeguard/llm";

import type {
  ArticlePatch,
  ArticleRecord,
  ProcessArticleJobDependencies,
} from "./article-pipeline-types";

export function hasText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function toRawMetaRecord(value: unknown) {
  return value && typeof value === "object"
    ? { ...(value as Record<string, unknown>) }
    : {};
}

export function hasRelevanceCheck(rawMeta: Record<string, unknown>) {
  const relevanceCheck = rawMeta.relevanceCheck;

  return Boolean(
    relevanceCheck &&
    typeof relevanceCheck === "object" &&
    typeof (relevanceCheck as { relevant?: unknown }).relevant === "boolean",
  );
}

export async function markStageAndCheck(
  dependencies: ProcessArticleJobDependencies,
  stage: (typeof JobPipelineStage)[keyof typeof JobPipelineStage],
) {
  await dependencies.markJobStage?.(stage);
  await checkJobControl(dependencies);
}

export async function checkJobControl(dependencies: ProcessArticleJobDependencies) {
  await dependencies.checkJobControl?.();
}

export function requireArticleField(value: string | null | undefined, label: string) {
  if (!hasText(value)) {
    throw new Error(`${label} is required for this processing step.`);
  }

  return value;
}

type LlmCallResult<T> = { result: T; usage: UsageResult | null };

export async function timedLlmCall<T>(
  fn: () => Promise<LlmCallResult<T>>,
  deps: ProcessArticleJobDependencies,
  input: {
    articleId: string;
    taskType: string;
    model: string;
  },
): Promise<LlmCallResult<T>> {
  const start = Date.now();
  const response = await fn();
  const responseTimeMs = Date.now() - start;

  if (deps.logLlmUsage) {
    await deps.logLlmUsage({
      articleId: input.articleId,
      taskType: input.taskType,
      model: input.model,
      usage: response.usage,
      responseTimeMs,
    });
  }

  return response;
}

export async function persistArticlePatch(
  dependencies: ProcessArticleJobDependencies,
  article: ArticleRecord,
  patch: ArticlePatch,
) {
  if (!dependencies.updateArticlePatch) {
    return;
  }

  await dependencies.updateArticlePatch(article.id, patch);
}

export async function updateArticlePatchWithFallback(
  dependencies: ProcessArticleJobDependencies,
  article: ArticleRecord,
  patch: ArticlePatch,
) {
  try {
    if (dependencies.updateArticlePatch) {
      await dependencies.updateArticlePatch(article.id, patch);
      return;
    }

    await dependencies.updateArticleContent(article.id, {
      titleEn: patch.titleEn ?? article.titleEn,
      titleZh: patch.titleZh ?? article.titleZh ?? "",
      summaryEn: patch.summaryEn ?? article.summaryEn ?? "",
      summaryZh: patch.summaryZh ?? article.summaryZh ?? "",
      contentMdEn:
        patch.contentMdEn ??
        requireArticleField(article.contentMdEn, "English body"),
      contentMdZh: patch.contentMdZh ?? article.contentMdZh ?? "",
      ecosystem: patch.ecosystem ?? article.ecosystem,
      riskCategory: patch.riskCategory ?? article.riskCategory,
      tags: patch.tags ?? article.tags,
      contentHash:
        patch.contentHash ??
        article.contentHash ??
        buildContentHash(
          patch.titleEn ?? article.titleEn,
          patch.contentMdEn ?? article.contentMdEn ?? "",
        ),
      rawMeta:
        patch.rawMeta && typeof patch.rawMeta === "object"
          ? (patch.rawMeta as Record<string, unknown>)
          : toRawMetaRecord(article.rawMeta),
    });
  } catch (error) {
    console.error(
      `updateArticlePatchWithFallback failed for article ${article.id}:`,
      error,
    );
    throw new Error(`Failed to persist article patch for ${article.id}`, {
      cause: error,
    });
  }
}

export function buildContentHash(title: string, content: string) {
  return createHash("sha256").update(`${title}\n${content}`).digest("hex");
}
