import {
  createChatCompletionTextWithRetry,
  type ChatCompletionsClient,
  type UsageResult,
} from "./chat";

import { stripJsonFence, tryParseJsonCandidates, resolvePrompt } from "./utils";

export const DEFAULT_TAG_PROMPT = `You are a short-tag extractor for supply-chain security articles.

Your task is to generate 2–4 concise tags suitable for display on a homepage card. Tags help readers quickly identify the ecosystem, attack technique, target platform, key asset, or defense topic of an article.

Rules:
1. Output ONLY valid JSON. No markdown fences, no explanation, no extra text.
2. Generate 2 to 4 tags per article. Return fewer rather than stretching for quantity.
3. Tags must be 2–16 characters, lowercase, kebab-case (e.g. "npm", "rce", "cloud-creds").
4. Do NOT invent tags the article does not clearly support. Guessing is worse than omitting.
5. When two tags overlap, keep the shorter, more specific one.
6. NEVER produce generic tags: supply-chain, open-source, security, risk, attack, article, unknown.

Preferred tag vocabulary (use these when applicable):

Ecosystem / Platform:
npm, pypi, go, maven, nuget, crates, docker, ghcr, k8s, actions, vscode, chrome, helm, terraform

Language:
js, ts, python, java, rust, ruby, php, dotnet, shell, cpp

Attack / Technique:
typosquat, dep-confusion, ato, injection, creds, dns-tunnel, stego, rat, worm, backdoor, rce, wiper, obfuscation, dropper, postinstall, persistence, exfil, privesc

Target Asset:
tokens, secrets, private-keys, cookies, wallets, cloud-creds, ssh-keys

Infrastructure:
aws, azure, gcp, github, oidc, sigstore, slsa, linux, windows, macos, circleci, jenkins, gitlab

Domain / Theme:
ci-cd, ai, llm, mcp, crypto, web3, defi, runtime, runner, egress, policy, sbom, sca, ir, monitoring

Output format:
{"tags":["tag1","tag2","tag3"]}`;

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

  const parsed = tryParseJsonCandidates(candidates);

  return parsed !== null ? normalizeGeneratedTags(parsed) : [];
}

export function buildTagExtractionPrompt(input: {
  systemPrompt: string;
  sourceText: string;
}) {
  return {
    systemPrompt: resolveTagPrompt(input.systemPrompt),
    userContent: input.sourceText,
  }
}

export function resolveTagPrompt(value: string | null | undefined) {
  const resolved = resolvePrompt(value, DEFAULT_TAG_PROMPT);

  if (resolved === LEGACY_TAG_PROMPT) {
    return DEFAULT_TAG_PROMPT;
  }

  return resolved;
}

export async function generateTags(input: {
  client: ChatCompletionsClient;
  model: string;
  systemPrompt: string;
  sourceText: string;
}) {
  const { systemPrompt, userContent } = buildTagExtractionPrompt({
    systemPrompt: input.systemPrompt,
    sourceText: input.sourceText,
  });
  const { text, usage } = await createChatCompletionTextWithRetry({
    client: input.client,
    model: input.model,
    systemPrompt,
    userContent,
  });

  return { result: extractGeneratedTags(text), usage };
}
