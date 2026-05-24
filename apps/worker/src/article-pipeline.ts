import {
  classifySecurityContent,
} from "@vibeguard/content";
import {
  buildLocalizedSummaryPrompt,
  buildTagSourceText,
  classifyRelevance,
  generateTags,
  DEFAULT_TAG_PROMPT,
  resolveTagPrompt,
  summarizeText,
  translateText,
} from "@vibeguard/llm";
import {
  ArticleStatus,
  JobPipelineStage,
  JobType,
} from "@vibeguard/shared";

// Re-export public API so external consumers keep working.
export { JobPausedSignal, JobCancelledSignal } from "./article-pipeline-types";
export type { ProcessArticleJobDependencies } from "./article-pipeline-types";

import type {
  ArticleRecord,
  LlmSettingsRecord,
  JobRecord,
  ProcessArticleFinalStatus,
} from "./article-pipeline-types";
import type { ProcessArticleJobDependencies } from "./article-pipeline-types";

import {
  buildContentHash,
  checkJobControl,
  hasRelevanceCheck,
  hasText,
  markStageAndCheck,
  persistArticlePatch,
  requireArticleField,
  timedLlmCall,
  toRawMetaRecord,
  updateArticlePatchWithFallback,
} from "./article-pipeline-helpers";

function resolveLocalizedSummaryPrompt(
  settings: Pick<LlmSettingsRecord, "summaryPromptEn" | "summaryPromptZh">,
  locale: "en" | "zh",
) {
  if (locale === "zh") {
    return settings.summaryPromptZh;
  }

  return settings.summaryPromptEn;
}

export async function processArticleJob(
  job: Pick<JobRecord, "articleId"> &
    Partial<Pick<JobRecord, "jobType" | "pipelineStage">>,
  dependencies: ProcessArticleJobDependencies,
) {
  const article = await dependencies.loadArticle(job.articleId);

  if (!article) {
    throw new Error(`Article not found for job: ${job.articleId}`);
  }

  const activeSettings = await dependencies.loadActiveLlmSettings();

  if (!activeSettings) {
    throw new Error("No active LLM settings found for article processing.");
  }

  const apiKey = dependencies.decryptSecret(activeSettings.apiKeyEncrypted);

  if (!apiKey) {
    throw new Error("Active LLM settings could not be decrypted.");
  }

  await dependencies.markArticleStatus(article.id, ArticleStatus.PROCESSING);
  await checkJobControl(dependencies);
  const client = dependencies.createOpenAIClient({
    baseUrl: activeSettings.baseUrl,
    apiKey,
  });
  const jobType = job.jobType ?? JobType.EXTRACT;

  if (jobType === JobType.SUMMARIZE) {
    await processSummarizeJob({
      article,
      activeSettings,
      client,
      dependencies,
    });
    await dependencies.markArticleStatus(article.id, ArticleStatus.READY);
    return;
  }

  if (jobType === JobType.TRANSLATE) {
    await processTranslateJob({
      article,
      activeSettings,
      client,
      dependencies,
    });
    await dependencies.markArticleStatus(article.id, ArticleStatus.READY);
    return;
  }

  const finalStatus = await processExtractJob({
    article,
    activeSettings,
    client,
    dependencies,
  });
  await dependencies.markArticleStatus(article.id, finalStatus);
}

async function processExtractJob(input: {
  article: ArticleRecord;
  activeSettings: LlmSettingsRecord;
  client: Parameters<typeof translateText>[0]["client"];
  dependencies: ProcessArticleJobDependencies;
}): Promise<ProcessArticleFinalStatus> {
  const rawMeta = toRawMetaRecord(input.article.rawMeta);
  let titleEn = input.article.titleEn;
  let contentMdEn = input.article.contentMdEn;
  let titleZh = input.article.titleZh;
  let contentMdZh = input.article.contentMdZh;
  let summaryEn = input.article.summaryEn;
  let summaryZh = input.article.summaryZh;

  if (!hasText(titleEn) || !hasText(contentMdEn)) {
    await markStageAndCheck(input.dependencies, JobPipelineStage.FETCH_SOURCE);
    const html = await input.dependencies.fetchArticleHtml(input.article.url);
    await markStageAndCheck(
      input.dependencies,
      JobPipelineStage.EXTRACT_CONTENT,
    );
    const extracted = await input.dependencies.extractMarkdownFromHtml(
      html,
      input.article.url,
    );

    titleEn = extracted.title;
    contentMdEn = extracted.contentMd;
    rawMeta.extraction = {
      author: extracted.author,
      description: extracted.description,
      publishedAt: extracted.publishedAt,
      siteName: extracted.siteName,
    };

    await persistArticlePatch(input.dependencies, input.article, {
      titleEn,
      contentMdEn,
      contentHash: buildContentHash(titleEn, contentMdEn),
      rawMeta,
    });
    await checkJobControl(input.dependencies);
  }

  const requiredTitleEn = requireArticleField(titleEn, "English title");
  const requiredContentMdEn = requireArticleField(contentMdEn, "English body");

  // 相关性检查：提取内容后立即判断，不相关的文章跳过后续所有 LLM 步骤。
  // 当一个暂停的任务在内容提取之后恢复时，原始内容已经存在数据库中，
  // 但相关性标记（relevance marker）可能尚未写入。因此在进入翻译流程之前，
  // 必须先执行一次相关性判定，确保已恢复的任务不会跳过这一关键检查。
  if (!hasRelevanceCheck(rawMeta)) {
    await markStageAndCheck(
      input.dependencies,
      JobPipelineStage.CLASSIFY_RELEVANCE,
    );
    const relevanceResult = await timedLlmCall(
      () =>
        classifyRelevance({
          client: input.client,
          model: input.activeSettings.model,
          systemPrompt: input.activeSettings.relevancePrompt,
          sourceText: `${requiredTitleEn}\n\n${requiredContentMdEn.slice(0, 4000)}`,
        }),
      input.dependencies,
      {
        articleId: input.article.id,
        taskType: "classify_relevance",
        model: input.activeSettings.model,
      },
    );
    const relevance = relevanceResult.result;
    rawMeta.relevanceCheck = {
      relevant: relevance.relevant,
      reason: relevance.reason,
      checkedAt: new Date().toISOString(),
    };
    if (!relevance.relevant) {
      rawMeta.relevanceFilter = {
        reason: relevance.reason,
        checkedAt: new Date().toISOString(),
      };
      await persistArticlePatch(input.dependencies, input.article, { rawMeta });
      await checkJobControl(input.dependencies);
      return ArticleStatus.FILTERED;
    }

    await persistArticlePatch(input.dependencies, input.article, { rawMeta });
    await checkJobControl(input.dependencies);
  }

  if (!hasText(titleZh)) {
    await markStageAndCheck(
      input.dependencies,
      JobPipelineStage.TRANSLATE_TITLE,
    );
    const titleZhResult = await timedLlmCall(
      () =>
        input.dependencies.translateText({
          client: input.client,
          model: input.activeSettings.model,
          systemPrompt: input.activeSettings.translateTitlePrompt,
          sourceText: requiredTitleEn,
        }),
      input.dependencies,
      {
        articleId: input.article.id,
        taskType: "translate_title",
        model: input.activeSettings.model,
      },
    );
    titleZh = titleZhResult.result;
    await persistArticlePatch(input.dependencies, input.article, { titleZh });
    await checkJobControl(input.dependencies);
  }

  if (!hasText(contentMdZh)) {
    await markStageAndCheck(
      input.dependencies,
      JobPipelineStage.TRANSLATE_CONTENT,
    );
    const contentMdZhResult = await timedLlmCall(
      () =>
        input.dependencies.translateText({
          client: input.client,
          model: input.activeSettings.model,
          systemPrompt: input.activeSettings.translateContentPrompt,
          sourceText: requiredContentMdEn,
        }),
      input.dependencies,
      {
        articleId: input.article.id,
        taskType: "translate_content",
        model: input.activeSettings.model,
      },
    );
    contentMdZh = contentMdZhResult.result;
    await persistArticlePatch(input.dependencies, input.article, {
      contentMdZh,
    });
    await checkJobControl(input.dependencies);
  }

  if (!hasText(summaryEn)) {
    await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_EN);
    const summaryEnResult = await timedLlmCall(
      () =>
        input.dependencies.summarizeText({
          client: input.client,
          model: input.activeSettings.model,
          systemPrompt: buildLocalizedSummaryPrompt(
            resolveLocalizedSummaryPrompt(input.activeSettings, "en"),
            "en",
          ),
          sourceText: requiredContentMdEn,
        }),
      input.dependencies,
      {
        articleId: input.article.id,
        taskType: "summarize_en",
        model: input.activeSettings.model,
      },
    );
    summaryEn = summaryEnResult.result;
    await persistArticlePatch(input.dependencies, input.article, { summaryEn });
    await checkJobControl(input.dependencies);
  }

  const requiredContentMdZh = requireArticleField(contentMdZh, "Chinese body");

  if (!hasText(summaryZh)) {
    await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_ZH);
    const summaryZhResult = await timedLlmCall(
      () =>
        input.dependencies.summarizeText({
          client: input.client,
          model: input.activeSettings.model,
          systemPrompt: buildLocalizedSummaryPrompt(
            resolveLocalizedSummaryPrompt(input.activeSettings, "zh"),
            "zh",
          ),
          sourceText: requiredContentMdEn,
        }),
      input.dependencies,
      {
        articleId: input.article.id,
        taskType: "summarize_zh",
        model: input.activeSettings.model,
      },
    );
    summaryZh = summaryZhResult.result;
    await persistArticlePatch(input.dependencies, input.article, { summaryZh });
    await checkJobControl(input.dependencies);
  }

  const requiredSummaryEn = requireArticleField(summaryEn, "English summary");
  await markStageAndCheck(input.dependencies, JobPipelineStage.GENERATE_TAGS);
  const [classification, generatedTags] = await Promise.all([
    Promise.resolve(
      classifySecurityContent({
        sourceName: input.article.sourceName,
        url: input.article.url,
        title: requiredTitleEn,
        summary:
          rawMeta.extraction && typeof rawMeta.extraction === "object"
            ? String(
                (rawMeta.extraction as { description?: unknown }).description ??
                  requiredSummaryEn,
              )
            : requiredSummaryEn,
        content: requiredContentMdEn,
        categories: Array.isArray(rawMeta.categories)
          ? (rawMeta.categories as string[])
          : undefined,
      }),
    ),
    generateArticleTags({
      dependencies: input.dependencies,
      client: input.client,
      model: input.activeSettings.model,
      systemPrompt: resolveTagPrompt(
        input.activeSettings.tagPrompt || DEFAULT_TAG_PROMPT,
      ),
      sourceText: buildTagSourceText({
        title: requiredTitleEn,
        summary: requiredSummaryEn,
        content: requiredContentMdEn,
      }),
      articleId: input.article.id,
    }),
  ]);
  const tags = generatedTags.length > 0 ? generatedTags : classification.tags;

  await input.dependencies.updateArticleContent(input.article.id, {
    titleEn: requiredTitleEn,
    titleZh: requireArticleField(titleZh, "Chinese title"),
    summaryEn: requiredSummaryEn,
    summaryZh: requireArticleField(summaryZh, "Chinese summary"),
    contentMdEn: requiredContentMdEn,
    contentMdZh: requiredContentMdZh,
    ecosystem: classification.ecosystem,
    riskCategory: classification.riskCategory,
    tags,
    contentHash: buildContentHash(requiredTitleEn, requiredContentMdEn),
    rawMeta,
  });
  await checkJobControl(input.dependencies);

  return ArticleStatus.READY;
}

async function generateArticleTags(input: {
  dependencies: ProcessArticleJobDependencies;
  client: Parameters<typeof generateTags>[0]["client"];
  model: string;
  systemPrompt: string;
  sourceText: string;
  articleId: string;
}) {
  try {
    const tagGenerator = input.dependencies.generateTags ?? generateTags;
    const tagsResult = await timedLlmCall(
      () =>
        tagGenerator({
          client: input.client,
          model: input.model,
          systemPrompt: input.systemPrompt,
          sourceText: input.sourceText,
        }),
      input.dependencies,
      {
        articleId: input.articleId,
        taskType: "generate_tags",
        model: input.model,
      },
    );

    return tagsResult.result;
  } catch {
    return [];
  }
}

async function processSummarizeJob(input: {
  article: ArticleRecord;
  activeSettings: LlmSettingsRecord;
  client: Parameters<typeof summarizeText>[0]["client"];
  dependencies: ProcessArticleJobDependencies;
}) {
  const contentMdEn = requireArticleField(
    input.article.contentMdEn,
    "English body",
  );
  await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_EN);
  const summaryEnResult = await timedLlmCall(
    () =>
      input.dependencies.summarizeText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: buildLocalizedSummaryPrompt(
          resolveLocalizedSummaryPrompt(input.activeSettings, "en"),
          "en",
        ),
        sourceText: contentMdEn,
      }),
    input.dependencies,
    {
      articleId: input.article.id,
      taskType: "summarize_en",
      model: input.activeSettings.model,
    },
  );
  await checkJobControl(input.dependencies);
  await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_ZH);
  const summaryZhResult = await timedLlmCall(
    () =>
      input.dependencies.summarizeText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: buildLocalizedSummaryPrompt(
          resolveLocalizedSummaryPrompt(input.activeSettings, "zh"),
          "zh",
        ),
        sourceText: contentMdEn,
      }),
    input.dependencies,
    {
      articleId: input.article.id,
      taskType: "summarize_zh",
      model: input.activeSettings.model,
    },
  );

  await updateArticlePatchWithFallback(input.dependencies, input.article, {
    summaryEn: summaryEnResult.result,
    summaryZh: summaryZhResult.result,
  });
  await checkJobControl(input.dependencies);
}

async function processTranslateJob(input: {
  article: ArticleRecord;
  activeSettings: LlmSettingsRecord;
  client: Parameters<typeof translateText>[0]["client"];
  dependencies: ProcessArticleJobDependencies;
}) {
  const titleEn = requireArticleField(input.article.titleEn, "English title");
  const contentMdEn = requireArticleField(
    input.article.contentMdEn,
    "English body",
  );
  await markStageAndCheck(input.dependencies, JobPipelineStage.TRANSLATE_TITLE);
  const titleZhResult = await timedLlmCall(
    () =>
      input.dependencies.translateText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: input.activeSettings.translateTitlePrompt,
        sourceText: titleEn,
      }),
    input.dependencies,
    {
      articleId: input.article.id,
      taskType: "translate_title",
      model: input.activeSettings.model,
    },
  );
  await checkJobControl(input.dependencies);
  await markStageAndCheck(
    input.dependencies,
    JobPipelineStage.TRANSLATE_CONTENT,
  );
  const contentMdZhResult = await timedLlmCall(
    () =>
      input.dependencies.translateText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: input.activeSettings.translateContentPrompt,
        sourceText: contentMdEn,
      }),
    input.dependencies,
    {
      articleId: input.article.id,
      taskType: "translate_content",
      model: input.activeSettings.model,
    },
  );
  await checkJobControl(input.dependencies);
  await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_EN);
  const summaryEnResult = await timedLlmCall(
    () =>
      input.dependencies.summarizeText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: buildLocalizedSummaryPrompt(
          resolveLocalizedSummaryPrompt(input.activeSettings, "en"),
          "en",
        ),
        sourceText: contentMdEn,
      }),
    input.dependencies,
    {
      articleId: input.article.id,
      taskType: "summarize_en",
      model: input.activeSettings.model,
    },
  );
  await checkJobControl(input.dependencies);
  await markStageAndCheck(input.dependencies, JobPipelineStage.SUMMARIZE_ZH);
  const summaryZhResult = await timedLlmCall(
    () =>
      input.dependencies.summarizeText({
        client: input.client,
        model: input.activeSettings.model,
        systemPrompt: buildLocalizedSummaryPrompt(
          resolveLocalizedSummaryPrompt(input.activeSettings, "zh"),
          "zh",
        ),
        sourceText: contentMdEn,
      }),
    input.dependencies,
    {
      articleId: input.article.id,
      taskType: "summarize_zh",
      model: input.activeSettings.model,
    },
  );

  await updateArticlePatchWithFallback(input.dependencies, input.article, {
    titleZh: titleZhResult.result,
    contentMdZh: contentMdZhResult.result,
    summaryEn: summaryEnResult.result,
    summaryZh: summaryZhResult.result,
  });
  await checkJobControl(input.dependencies);
}
