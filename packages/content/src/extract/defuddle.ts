import { parseHTML } from "linkedom";
import { Defuddle } from "defuddle/node";

const DECORATIVE_IMAGE_ALT_TEXTS = new Set(["sidebar cta background"]);
const DECORATIVE_IMAGE_URL_PARTS = ["sidebar-cta-bg"];

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
