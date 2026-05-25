import fs from "node:fs";

import { describe, expect, it } from "vitest";

describe("MCP documentation page", () => {
  const pageSource = fs.readFileSync(
    "apps/web/app/[lang]/mcp/page.tsx",
    "utf8",
  );

  it("documents every MCP tool exposed by the server", () => {
    const expectedTools = [
      "search_articles",
      "get_article",
      "check_packages",
      "search_advisories",
      "package_profile",
      "get_cve",
      "security_overview",
      "security_sync_status",
    ];

    for (const tool of expectedTools) {
      expect(pageSource).toContain(`name: "${tool}"`);
    }
  });

  it("explains the expanded security-query MCP surface", () => {
    expect(pageSource).toContain("结构化漏洞公告");
    expect(pageSource).toContain("单个包的风险画像");
    expect(pageSource).toContain("CVSS、EPSS、CISA KEV、CWE");
    expect(pageSource).toContain("安全数据源同步状态");
    expect(pageSource).toContain("本地 OSV");
    expect(pageSource).toContain("NVD");
  });

  it("removes the summary metric cards above the endpoint", () => {
    expect(pageSource).not.toContain("const capabilityCards");
    expect(pageSource).not.toContain("MCP 工具");
    expect(pageSource).not.toContain("包生态");
    expect(pageSource).not.toContain("OSV+");
    expect(pageSource).not.toContain("capabilityCards.map");
  });

  it("adds a copy button next to the MCP endpoint URL", () => {
    expect(pageSource).toContain(
      'import { CopyButton } from "@/components/ui/copy-button"',
    );
    expect(pageSource).toContain("<CopyButton");
    expect(pageSource).toContain("text={mcpUrl}");
    expect(pageSource).toContain('label={lang === "zh" ? "复制" : "Copy"}');
    expect(pageSource).toContain(
      'copiedLabel={lang === "zh" ? "已复制" : "Copied"}',
    );
  });

  it("keeps available tools readable in a compact two-zone layout", () => {
    expect(pageSource).toContain("lg:grid-cols-[minmax(0,16rem)_1fr]");
    expect(pageSource).toContain("xl:grid-cols-2");
    expect(pageSource).toContain("grid min-h-18 content-start gap-2");
    expect(pageSource).toContain("block w-fit");
    expect(pageSource).toContain("min-h-18");
    expect(pageSource).not.toContain(
      "flex items-start gap-3 rounded-[0.85rem]",
    );
    expect(pageSource).not.toContain("sm:grid-cols-[minmax(0,12.5rem)_1fr]");
  });
});
