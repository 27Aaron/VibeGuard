import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
} from "./chat";

import { stripJsonFence } from "./utils";

export const DEFAULT_TAG_PROMPT = `你是一个供应链安全文章的短标签提取器。

你的任务是为文章生成适合在首页卡片上展示的短 tag。
tag 应帮助读者快速判断文章涉及的生态、攻击手法、目标平台、关键资产或防护主题。

请严格遵守：

1. 只输出 JSON，不要输出 Markdown、解释或多余文字。
2. 每篇文章生成 2 到 4 个 tag。
3. tag 必须短，优先 3 到 14 个字符。
4. tag 使用英文小写和 kebab-case，不要使用空格。
5. 优先使用短 tag，例如 npm、pypi、aws、rce、worm、creds、actions。
6. 不要生成过泛 tag，例如 supply-chain、open-source、security、risk、attack、article。
7. 不要生成过长 tag，例如 credential-theft、supply-chain-attack、github-actions-security。
8. 不要为了凑数量硬生成 tag，证据不足时可以只返回 2 个。
9. 如果文章没有明确提到某个生态、攻击技术或平台，不要猜测。
10. 如果多个 tag 意思重复，只保留更短、更具体的那个。

优先选择这些风格的 tag：

生态/平台：
npm, pypi, go, maven, nuget, crates, docker, ghcr, k8s, actions, vscode, chrome, helm, terraform

语言：
js, ts, python, java, rust, ruby, php, dotnet, shell, cpp

攻击/技术：
typosquat, dep-confusion, ato, injection, creds, dns-tunnel, stego, rat, worm, backdoor, rce, wiper, obfuscation, dropper, postinstall, persistence, exfil, privesc

目标资产：
tokens, secrets, private-keys, cookies, wallets, cloud-creds, ssh-keys

基础设施：
aws, azure, gcp, github, oidc, sigstore, slsa, linux, windows, macos, circleci, jenkins, gitlab

领域/主题：
ci-cd, ai, llm, mcp, crypto, web3, defi, runtime, runner, egress, policy, sbom, sca, ir, monitoring

输出格式：

{
  "tags": ["tag1", "tag2", "tag3"]
}

文章原始正文：
{{content}}`;

const LEGACY_TAG_PROMPT =
  "Extract short supply-chain security tags as strict JSON.";

const TAG_ALIASES = new Map<string, string | null>([
  ["github-actions", "actions"],
  ["github-action", "actions"],
  ["credential-theft", "creds"],
  ["secret-theft", "creds"],
  ["secret-exfiltration", "creds"],
  ["runner-security", "runner"],
  ["runtime-monitoring", "runtime"],
  ["egress-control", "egress"],
  ["cloud-credentials", "cloud-creds"],
  ["supply-chain", null],
  ["supply-chain-attack", null],
  ["open-source", null],
]);

const BLOCKED_TAGS = new Set([
  "article",
  "attack",
  "risk",
  "security",
  "unknown",
]);

function normalizeTag(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const base = value
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\bc#\b/g, "dotnet")
    .replace(/\bc\+\+\b/g, "cpp")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  const aliased = TAG_ALIASES.has(base) ? TAG_ALIASES.get(base) : base;

  if (!aliased || BLOCKED_TAGS.has(aliased)) {
    return null;
  }

  if (aliased.length < 2 || aliased.length > 16) {
    return null;
  }

  return aliased;
}

export function normalizeGeneratedTags(values: unknown) {
  const rawTags = Array.isArray(values)
    ? values
    : values && typeof values === "object" && Array.isArray((values as { tags?: unknown }).tags)
      ? (values as { tags: unknown[] }).tags
      : [];
  const tags = new Set<string>();

  for (const value of rawTags) {
    const tag = normalizeTag(value);

    if (tag) {
      tags.add(tag);
    }

    if (tags.size >= 4) {
      break;
    }
  }

  return Array.from(tags);
}

export function extractGeneratedTags(value: string) {
  const stripped = stripJsonFence(value);
  const candidates = [
    stripped,
    stripped.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return normalizeGeneratedTags(JSON.parse(candidate));
    } catch {
      // Try the next candidate.
    }
  }

  return [];
}

export function buildTagExtractionPrompt(input: {
  systemPrompt: string;
  sourceText: string;
}) {
  const prompt = resolveTagPrompt(input.systemPrompt);

  if (prompt.includes("{{content}}")) {
    return prompt.replaceAll("{{content}}", input.sourceText);
  }

  return `${prompt}\n\n文章原始正文：\n${input.sourceText}`;
}

export function resolveTagPrompt(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();

  if (!normalized || normalized === LEGACY_TAG_PROMPT) {
    return DEFAULT_TAG_PROMPT;
  }

  return normalized;
}

export async function generateTags(input: {
  client: ChatCompletionsClient;
  model: string;
  systemPrompt: string;
  sourceText: string;
}) {
  const prompt = buildTagExtractionPrompt({
    systemPrompt: input.systemPrompt,
    sourceText: input.sourceText,
  });
  const text = await createChatCompletionTextWithRetry({
    client: input.client,
    model: input.model,
    prompt,
  });

  return extractGeneratedTags(text);
}
