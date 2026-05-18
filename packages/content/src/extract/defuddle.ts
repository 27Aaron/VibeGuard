import { parseHTML } from "linkedom";
import { Defuddle } from "defuddle/node";

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
    contentMd: result.content.trim(),
    author: result.author ?? null,
    description: result.description ?? null,
    publishedAt: result.published ?? null,
    siteName: result.site ?? null,
  };
}
