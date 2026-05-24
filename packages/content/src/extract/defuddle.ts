import { parseHTML } from "linkedom";
import { Defuddle } from "defuddle/node";

const DECORATIVE_IMAGE_ALT_TEXTS = new Set(["sidebar cta background"]);
const DECORATIVE_IMAGE_URL_PARTS = ["sidebar-cta-bg"];
const SOCKET_CTA_TEXT_LINES = new Set([
  "secure your dependencies with us",
  "socket proactively blocks malicious open source packages in your code.",
]);

export type ExtractedArticle = {
  title: string;
  contentMd: string;
  author: string | null;
  description: string | null;
  publishedAt: string | null;
  siteName: string | null;
};

export async function extractMarkdownFromHtml(
  html: string,
  url: string,
): Promise<ExtractedArticle> {
  const { document } = parseHTML(html);
  const result = await Defuddle(document, url, {
    markdown: true,
    useAsync: false,
  });

  return {
    title: result.title?.trim() || "Untitled Article",
    contentMd: cleanExtractedMarkdown(result.content),
    author: result.author ?? null,
    description: result.description ?? null,
    publishedAt: result.published ?? null,
    siteName: result.site ?? null,
  };
}

function cleanExtractedMarkdown(markdown: string) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => !isDecorativeMarkdownImageLine(line))
    .filter((line) => !isSocketCtaMarkdownLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isDecorativeMarkdownImageLine(line: string) {
  const match = line
    .trim()
    .match(/^!\[([^\]]*)\]\(\s*(<?[^>\s)]+>?)\s*(?:["'][^"']*["'])?\s*\)$/);

  if (!match) {
    return false;
  }

  const altText = normalizeDecorativeImageToken(match[1] ?? "");
  const imageUrl = (match[2] ?? "").toLowerCase();

  return (
    DECORATIVE_IMAGE_ALT_TEXTS.has(altText) ||
    DECORATIVE_IMAGE_URL_PARTS.some((part) => imageUrl.includes(part))
  );
}

function normalizeDecorativeImageToken(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isSocketCtaMarkdownLine(line: string) {
  const trimmed = line.trim();

  if (SOCKET_CTA_TEXT_LINES.has(normalizeMarkdownTextLine(trimmed))) {
    return true;
  }

  return /^\[install\]\(\s*<?https?:\/\/socket\.dev\/features\/github(?:[?#][^>\s)]*)?>?\s*(?:["'][^"']*["'])?\s*\)$/i.test(
    trimmed,
  );
}

function normalizeMarkdownTextLine(value: string) {
  return value
    .replace(/^#{1,6}\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
