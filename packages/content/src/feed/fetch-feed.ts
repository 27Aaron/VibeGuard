import Parser from "rss-parser";

import type { FeedItemInput } from "./normalize";
import { DEFAULT_USER_AGENT, assertHttpUrl } from "../shared/http";

type ParsedFeed = Parser.Output<FeedItemInput>;

const parser = new Parser<Record<string, never>, FeedItemInput>();

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 1_000_000;

export async function fetchFeed(feedUrl: string): Promise<ParsedFeed> {
  assertHttpUrl(feedUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(feedUrl, {
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? "0");

    if (contentLength > DEFAULT_MAX_BYTES) {
      throw new Error("Feed response is too large.");
    }

    const body = await response.text();

    if (body.length > DEFAULT_MAX_BYTES) {
      throw new Error("Feed response is too large.");
    }

    return parser.parseString(body);
  } finally {
    clearTimeout(timeout);
  }
}
