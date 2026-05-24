import { createServer } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFeed } from "../../packages/content/src/feed/fetch-feed";

vi.mock("../../packages/content/src/shared/http", async () => {
  const actual = await vi.importActual(
    "../../packages/content/src/shared/http",
  );
  return {
    ...actual,
    assertHttpUrl: vi.fn().mockResolvedValue(undefined),
    safeFetch: fetch,
  };
});

const servers = new Set<ReturnType<typeof createServer>>();

afterEach(async () => {
  await Promise.all(
    Array.from(servers, (server) => {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }),
  );
  servers.clear();
});

describe("fetchFeed", () => {
  it("should fetch and parse an rss feed", async () => {
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Example Feed</title>
    <item>
      <title>Example Post</title>
      <link>https://example.com/post</link>
      <pubDate>Tue, 19 May 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;
    const server = createServer((_, response) => {
      response.writeHead(200, { "content-type": "application/rss+xml" });
      response.end(rss);
    });
    servers.add(server);

    const address = await new Promise<string>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const details = server.address();

        if (!details || typeof details === "string") {
          reject(new Error("Unable to resolve test server address"));
          return;
        }

        resolve(`http://127.0.0.1:${details.port}/feed.xml`);
      });
      server.on("error", reject);
    });

    const result = await fetchFeed(address);

    expect(result.title).toBe("Example Feed");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "Example Post",
      link: "https://example.com/post",
    });
  });
});
