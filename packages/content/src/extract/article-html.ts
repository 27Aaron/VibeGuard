const DEFAULT_USER_AGENT =
  "content-foundation-bot/0.1 (+https://localhost/content-foundation)";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 2_000_000;

function assertHttpUrl(url: string) {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Article URL must use http or https.");
  }
}

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
