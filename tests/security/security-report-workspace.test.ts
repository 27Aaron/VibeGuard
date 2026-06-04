import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const scriptsDir = path.resolve("skill/vibeguard/scripts");
const assetsDir = path.resolve("skill/vibeguard/assets");
const buildReportPath = path.join(scriptsDir, "build_report.py");
const reportTemplatePath = path.join(assetsDir, "report_template.html");
const reportCssPath = path.join(assetsDir, "report.css");
const reportJsPath = path.join(assetsDir, "report.js");
const tempPaths: string[] = [];

function makeTempDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempPaths.push(dir);
  return dir;
}

afterEach(() => {
  for (const tempPath of tempPaths.splice(0)) {
    fs.rmSync(tempPath, { recursive: true, force: true });
  }
});

function writeAnalysis(projectDir: string) {
  const runDir = path.join(projectDir, ".vibeguard", "20260604-071500");
  const assetsDir = path.join(runDir, "assets");
  const contentDir = path.join(runDir, "content");
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(contentDir, { recursive: true });
  const analysisPath = path.join(assetsDir, "analysis.json");
  fs.writeFileSync(
    analysisPath,
    JSON.stringify({
      generated_at: "2026-06-04 07:15:00",
      scan_seconds: 1.2,
      project: {
        path: projectDir,
        name: path.basename(projectDir),
        ecosystems: [],
        lockfiles: [],
        git_repo: false,
        git_branch: null,
        total_packages: 0,
        total_vulnerabilities: 0,
      },
      risk_summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      summary: {
        tldr: "未发现依赖漏洞。",
        detail: "本次只生成测试报告。",
        priority: [],
      },
    }),
  );
  return { analysisPath, contentDir, assetsDir };
}

describe("VibeGuard report workspace", () => {
  it("writes default static HTML into the run content directory", () => {
    const projectDir = makeTempDir("vibeguard-report-project-");
    const { analysisPath, contentDir } = writeAnalysis(projectDir);

    const result = spawnSync(process.env.PYTHON ?? "python3", [buildReportPath, "--no-open", analysisPath], {
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const htmlPath = path.join(contentDir, "security-report.html");
    expect(fs.existsSync(htmlPath)).toBe(true);
    const html = fs.readFileSync(htmlPath, "utf8");
    expect(html).toContain(":root {");
    expect(html).toContain("window.__VIBEGUARD_REPORT_DATA__");
    expect(html).toContain("function safeHref");
    expect(html).toContain("能力边界");
    expect(html).toContain("安全往往不是最显眼的需求");
    expect(html).toContain("让容易被忽视的供应链问题更早暴露出来");
    expect(html).toContain("不能替代代码审计、渗透测试或部署安全评估");
    expect(html).toContain('class="summary-boundary warning"');
    expect(html).toContain('class="summary outdated-empty"');
    expect(html).not.toContain("__REPORT_");
    expect(html).not.toContain('href="report.css"');
    expect(html).not.toContain('src="report.js"');
    expect(result.stdout).toContain(htmlPath);
    expect(result.stdout).not.toContain("Desktop");
    expect(result.stdout).not.toContain("127.0.0.1");
    expect(result.stdout).not.toContain("open '");
    expect(result.stdout).toContain("已跳过自动打开 HTML");
    expect(result.stdout).toContain("如果你想继续处理修复");
    expect(result.stdout).toContain("可以修 / 修复 / OK / Yes");
  });

  it("prints a static report path without requiring a local server", () => {
    const projectDir = makeTempDir("vibeguard-report-project-");
    const { analysisPath, contentDir } = writeAnalysis(projectDir);

    const result = spawnSync(process.env.PYTHON ?? "python3", [buildReportPath, "--no-open", analysisPath], {
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain(path.join(contentDir, "security-report.html"));
    expect(result.stdout).toContain("HTML 已保存");
    expect(result.stdout).toContain("已跳过自动打开 HTML");
    expect(result.stdout).not.toContain("server");
  });

  it("keeps report source assets split while generated HTML remains standalone", () => {
    const template = fs.readFileSync(reportTemplatePath, "utf8");
    const css = fs.readFileSync(reportCssPath, "utf8");
    const js = fs.readFileSync(reportJsPath, "utf8");

    expect(template).toContain("__REPORT_CSS__");
    expect(template).toContain("__REPORT_DATA__");
    expect(template).toContain("__REPORT_JS__");
    expect(template).not.toContain("function safeHref");
    expect(css).toContain(":root {");
    expect(css).toContain("@media print");
    expect(js).toContain("window.__VIBEGUARD_REPORT_DATA__");
    expect(js).toContain("function safeHref");
    expect(js).not.toContain("__REPORT_DATA__");
  });

  it("keeps dense report tables stable with seven-row reveal defaults", () => {
    const css = fs.readFileSync(reportCssPath, "utf8");
    const js = fs.readFileSync(reportJsPath, "utf8");

    expect(js).toContain("const VULN_SHOW = 7;");
    expect(js).toContain("const OUTDATED_SHOW = 7;");
    expect(js).toContain("function packageColumnWidthStyle(rows)");
    expect(js).toContain("function renderTableColgroup(columns)");
    expect(js).toContain('class="stable-table vuln-table"');
    expect(js).toContain('class="stable-table outdated-table"');
    expect(js).toContain('class="package-cell"');
    expect(js).toContain("outdated-extra");
    expect(js).toContain("toggleOutdated(this)");
    expect(css).toContain("table-layout: fixed;");
    expect(css).toContain(".package-cell b");
    expect(css).toContain("text-overflow: ellipsis;");
    expect(css).toContain("white-space: nowrap;");
    expect(css).toContain("--warning-border");
    expect(css).toContain(".summary-boundary.warning");
    expect(css).toContain(".outdated-empty");
  });

  it("keeps vulnerability section heading concise and explanations advisory-specific", () => {
    const js = fs.readFileSync(reportJsPath, "utf8");

    expect(js).toContain('"命中漏洞"');
    expect(js).not.toContain("命中漏洞（按修复优先级排序）");
    expect(js).toContain("function advisorySummaryText(r)");
    expect(js).toContain("r.advisory_summary");
    expect(js).toContain("server-side request forgery");
    expect(js).toContain("服务端请求伪造");
  });

  it("uses selected Lucide icons for report section headers", () => {
    const js = fs.readFileSync(reportJsPath, "utf8");

    expect(js).toContain("lucide-file-chart-column");
    expect(js).toContain("lucide-shield-alert");
    expect(js).toContain("lucide-brush-cleaning");
    expect(js).toContain("lucide-shield-x");
    expect(js).toContain("lucide-eye");
    expect(js).toContain('"仓库卫生"');
    expect(js).toContain('"人工复核"');
    expect(js).toContain('section("人工复核", items.length, cards, "", "review")');
    expect(js).toContain('"hygiene"');
    expect(js).not.toContain('"仓库卫生扫描"');
    expect(js).not.toContain('"需要业务或部署确认的事项"');
  });

  it("renders report sections in the preferred reading order", () => {
    const js = fs.readFileSync(reportJsPath, "utf8");
    const summaryIndex = js.indexOf("renderReportSummary(DATA.summary)");
    const hygieneIndex = js.indexOf("renderHygiene(DATA.hygiene)");
    const vulnIndex = js.indexOf("renderVulnTable(DATA.vulns)");
    const outdatedIndex = js.indexOf("renderOutdated(DATA.outdated)");

    expect(summaryIndex).toBeGreaterThan(-1);
    expect(hygieneIndex).toBeGreaterThan(summaryIndex);
    expect(vulnIndex).toBeGreaterThan(hygieneIndex);
    expect(outdatedIndex).toBeGreaterThan(vulnIndex);
  });

  it("keeps repository hygiene copy visually compact", () => {
    const css = fs.readFileSync(reportCssPath, "utf8");
    const js = fs.readFileSync(reportJsPath, "utf8");

    expect(js).toContain("function hygieneNote(label, value)");
    expect(js).toContain('class="summary hygiene-summary"');
    expect(js).toContain('class="hygiene-note"');
    expect(css).toContain(".hygiene-summary {");
    expect(css).toContain(".hygiene-note p {");
    expect(css).toContain("font-size: 14px;");
  });

  it("balances report footer spacing against the page edge", () => {
    const css = fs.readFileSync(reportCssPath, "utf8");

    expect(css).toContain("padding: 24px 20px;");
    expect(css).toContain("footer {\n    margin-top: 24px;");
  });

  it("keeps compact mobile section headers centered and expanded cards breathable", () => {
    const css = fs.readFileSync(reportCssPath, "utf8");

    expect(css).toContain("@media (max-width: 640px)");
    expect(css).toContain(".sec h2 {\n        align-items: center;\n        flex-wrap: wrap;\n    }");
    expect(css).toContain(".item-body {\n        padding: 14px;\n    }");
    expect(css).not.toContain(".sec h2 {\n        align-items: flex-start;\n        flex-wrap: wrap;\n    }");
    expect(css).not.toContain(".item-body {\n        padding: 0 14px 14px;\n    }");
  });

  it("keeps cross-platform static report openers without a local server", () => {
    const source = fs.readFileSync(buildReportPath, "utf8");

    expect(source).toContain('sys.platform == "darwin"');
    expect(source).toContain('getattr(os, "startfile", None)');
    expect(source).toContain('"xdg-open"');
    expect(source).toContain('"gio"');
    expect(source).toContain('"wslview"');
    expect(source).toContain("webbrowser.open_new_tab");
    expect(source).not.toContain("localhost");
    expect(source).not.toContain("127.0.0.1");
  });
});
