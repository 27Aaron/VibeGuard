import fs from "node:fs";

import { describe, expect, it } from "vitest";

const skillText = fs.readFileSync("skill/vibeguard/SKILL.md", "utf8");
const frontmatter = skillText.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1] ?? "";

describe("security skill boundary", () => {
  it("keeps project scanning in the local skill flow instead of server-side content helpers", () => {
    const envExample = fs.readFileSync(".env.example", "utf8");
    const contentIndex = fs.readFileSync(
      "packages/content/src/index.ts",
      "utf8",
    );

    expect(envExample).not.toContain("VIBEGUARD_PROJECT_SECURITY_");
    expect(contentIndex).not.toContain("project-security");
  });

  it("keeps broad natural-language triggers in the skill description", () => {
    const triggerPhrases = [
      "帮我看看项目有没有安全问题",
      "安全扫描",
      "扫一下项目",
      "依赖有没有漏洞",
      "木马包",
      "恶意包",
      "硬编码密钥",
      "API Key",
      "token",
      "env 是否误提交",
      "gitignore 是否合理",
      "依赖是否太旧",
    ];

    for (const phrase of triggerPhrases) {
      expect(description).toContain(phrase);
    }
  });

  it("requires a docs report before permission-gated fixes", () => {
    expect(skillText).toContain("当前工作目录的 `docs/`");
    expect(skillText).toContain("docs/security-report-YYYY-MM-DD.md");
    expect(skillText).toContain("用户阅读报告后明确允许修复");
  });

  it("keeps the API privacy boundary to package coordinates only", () => {
    expect(skillText).toContain("只发送最小必要信息");
    expect(skillText).toContain("`ecosystem`、`name`、`version`");
    expect(skillText).toContain("不上传源码、lockfile、env 或密钥");
  });
});
