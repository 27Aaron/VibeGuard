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

  it("documents the dependency-scanning capability boundary", () => {
    expect(skillText).toContain("能力边界");
    expect(skillText).toContain("安全往往不是最显眼的需求");
    expect(skillText).toContain("让容易被忽视的供应链问题更早暴露出来");
    expect(skillText).toContain("不能替代代码审计、渗透测试或部署安全评估");
    expect(skillText).toContain("代码层面的权限、业务逻辑、SQL 注入、XSS");
  });

  it("requires final replies to keep the full quoted capability boundary", () => {
    expect(skillText).toContain("对话最终回复");
    expect(skillText).toContain("必须使用 Markdown 引用格式");
    expect(skillText).toContain("> 安全往往不是最显眼的需求");
    expect(skillText).not.toContain("▎ 安全往往不是最显眼的需求");
    expect(skillText).not.toContain("VibeGuard 覆盖依赖漏洞、过期依赖和仓库卫生");
  });

  it("requires an ecosystem preflight before full dependency scanning", () => {
    expect(skillText).toContain("生态预检");
    expect(skillText).toContain("JavaScript/TypeScript、Python、Go、Rust");
    expect(skillText).toContain("`language_support.supported` 为 `true`");
    expect(skillText).toContain("漏洞 API 检查");
    expect(skillText).toContain("暂不支持依赖漏洞扫描");
    expect(skillText).toContain("只做仓库卫生扫描");
    expect(skillText).toContain("硬编码密钥");
    expect(skillText).toContain("敏感文件跟踪");
    expect(skillText).toContain("不要调用漏洞 API");
  });

  it("documents the preflight script and scoped OS package-manager detection", () => {
    expect(skillText).toContain("scripts/preflight.py");
    expect(skillText).toContain("python3 scripts/preflight.py");
    expect(skillText).toContain("py -3 scripts/preflight.py");
    expect(skillText).not.toContain("python scripts/preflight.py [project_path]");
    expect(skillText).not.toContain("python3 scripts/preflight.py [project_path]");
    expect(skillText).toContain("`.vibeguard/<timestamp>/assets/preflight.json`");
    expect(skillText).toContain("`.vibeguard/`");
    expect(skillText).toContain("依赖文件");
    expect(skillText).toContain("操作系统");
    expect(skillText).toContain("Linux 发行版");
    expect(skillText).toContain("包管理器");
    expect(skillText).toContain("系统更新工具");
    expect(skillText).toContain("不要在预检阶段执行软件更新");
  });

  it("keeps scan commands clean by reusing the preflight JSON", () => {
    expect(skillText).toContain("scripts/scan.py --preflight");
    expect(skillText).toContain("读取 Step 0 的 preflight JSON");
    expect(skillText).toContain("`.vibeguard/<timestamp>/assets/scan.json`");
    expect(skillText).toContain("`.vibeguard/<timestamp>/assets/analysis.json`");
    expect(skillText).toContain("`.vibeguard/<timestamp>/content/security-report.html`");
    expect(skillText).not.toContain("> /tmp/vibeguard_scan.json");
    expect(skillText).not.toContain("%TEMP%\\vibeguard_scan.json");
    expect(skillText).not.toContain("/tmp/vibeguard_analysis.json");
    expect(skillText).not.toContain("%TEMP%\\vibeguard_analysis.json");
    expect(skillText).not.toContain("~/Desktop/security-report.html");
    expect(skillText).not.toContain("%USERPROFILE%\\Desktop\\security-report.html");
    expect(skillText).not.toContain("python scripts/scan.py [project_path]");
    expect(skillText).not.toContain("python3 scripts/scan.py [project_path]");
    expect(skillText).toContain("输出路径由脚本写入 `output_file`");
  });

  it("uses static HTML output instead of a local report server", () => {
    expect(skillText).toContain("默认生成静态 HTML 报告");
    expect(skillText).toContain(
      "python3 scripts/build_report.py .vibeguard/<timestamp>/assets/analysis.json",
    );
    expect(skillText).toContain(
      "py -3 scripts/build_report.py .vibeguard/<timestamp>/assets/analysis.json",
    );
    expect(skillText).toContain("报告已生成: `.vibeguard/<timestamp>/content/security-report.html`");
    expect(skillText).toContain("自动打开");
    expect(skillText).toContain("不要启动本地 server");
    expect(skillText).not.toContain("scripts/server.py");
    expect(skillText).not.toContain("127.0.0.1` 随机端口");
    expect(skillText).not.toContain("释放本地端口");
  });
});
