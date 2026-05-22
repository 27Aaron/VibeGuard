import { DEFAULT_USER_AGENT, assertHttpUrl } from "../shared/http";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2_000_000;

export async function fetchArticleHtml(
  url: string,
  fetchImpl: typeof fetch = fetch,
) {
  assertHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetchImpl(url, {
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article HTML: ${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");

    if (contentLength > DEFAULT_MAX_BYTES) {
      throw new Error("Article HTML response is too large.");
    }

    const html = await response.text();

    if (html.length > DEFAULT_MAX_BYTES) {
      throw new Error("Article HTML response is too large.");
    }

    return html;
  } finally {
    clearTimeout(timeout);
  }
}
