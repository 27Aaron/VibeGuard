import { createServer } from "node:http";

import { afterEach, describe, expect, it } from "vitest";

import { fetchArticleHtml } from "../packages/content/src/extract/article-html";
import { extractMarkdownFromHtml } from "../packages/content/src/extract/defuddle";

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

describe("fetchArticleHtml", () => {
  it("should fetch raw html from a page", async () => {
    const html = "<html><body><article><h1>Hello</h1></article></body></html>";
    const server = createServer((_, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
    });
    servers.add(server);

    const url = await new Promise<string>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const details = server.address();

        if (!details || typeof details === "string") {
          reject(new Error("Unable to resolve test server address"));
          return;
        }

        resolve(`http://127.0.0.1:${details.port}/article`);
      });
      server.on("error", reject);
    });

    const result = await fetchArticleHtml(url);

    expect(result).toContain("<h1>Hello</h1>");
  });
});

describe("extractMarkdownFromHtml", () => {
  it("should extract markdown content and metadata from article html", async () => {
    const html = `
      <html lang="en">
        <head>
          <title>Example article</title>
          <meta name="author" content="Alice" />
          <meta name="description" content="A concise summary." />
        </head>
        <body>
          <header>Navigation</header>
          <article>
            <h1>Example article</h1>
            <p>First paragraph.</p>
            <p>Second paragraph.</p>
          </article>
          <footer>Footer links</footer>
        </body>
      </html>
    `;

    const result = await extractMarkdownFromHtml(
      html,
      "https://example.com/posts/example-article",
    );

    expect(result.title).toBe("Example article");
    expect(result.author).toBe("Alice");
    expect(result.description).toBe("A concise summary.");
    expect(result.contentMd).toContain("First paragraph.");
    expect(result.contentMd).toContain("Second paragraph.");
    expect(result.contentMd).not.toContain("Navigation");
  });
});
