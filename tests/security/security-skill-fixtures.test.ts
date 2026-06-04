import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const scriptsDir = path.resolve("skill/vibeguard/scripts");
const analyzePath = path.join(scriptsDir, "analyze_scan.py");
const renderMarkdownPath = path.join(scriptsDir, "render_markdown.py");
const runAuditPath = path.join(scriptsDir, "run_audit.py");
const templatePath = path.resolve("skill/vibeguard/assets/report_template.html");
const reportJsPath = path.resolve("skill/vibeguard/assets/report.js");
const tempPaths: string[] = [];

function makeTempDir(prefix: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempPaths.push(dir);
  return dir;
}

function runPython(args: string[], cwd = process.cwd()) {
  const result = spawnSync(process.env.PYTHON ?? "python3", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONPATH: scriptsDir,
    },
  });
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return result;
}

afterEach(() => {
  for (const tempPath of tempPaths.splice(0)) {
    fs.rmSync(tempPath, { recursive: true, force: true });
  }
});

describe("VibeGuard skill fixtures", () => {
  it("parses Pipfile.lock and scans allowed dot-directories without leaking short secrets", () => {
    const projectDir = makeTempDir("vibeguard-skill-fixture-");
    const workflowDir = path.join(projectDir, ".github", "workflows");
    fs.mkdirSync(workflowDir, { recursive: true });
    fs.writeFileSync(
      path.join(projectDir, "Pipfile.lock"),
      JSON.stringify({
        default: {
          requests: { version: "==2.31.0" },
        },
        develop: {
          pytest: { version: "==8.2.0" },
        },
      }),
    );
    fs.writeFileSync(
      path.join(workflowDir, "deploy.yml"),
      'env:\n  password = "shortpass"\n',
    );

    const code = [
      "import json, sys, scan",
      "project = sys.argv[1]",
      "print(json.dumps({",
      "  'pipfile': scan.parse_pipfile_lock(project),",
      "  'secrets': scan.scan_secrets(project, max_files=50),",
      "}, ensure_ascii=False))",
    ].join("\n");
    const result = runPython(["-c", code, projectDir]);
    const output = JSON.parse(result.stdout);

    expect(output.pipfile).toEqual([
      expect.objectContaining({
        ecosystem: "pypi",
        name: "requests",
        version: "2.31.0",
        source: "Pipfile.lock",
      }),
      expect.objectContaining({
        ecosystem: "pypi",
        name: "pytest",
        version: "8.2.0",
        source: "Pipfile.lock",
      }),
    ]);
    expect(output.secrets).toEqual([
      expect.objectContaining({
        file: path.join(".github", "workflows", "deploy.yml"),
        type: "generic_password",
      }),
    ]);
    expect(output.secrets[0].preview).not.toContain("shortpass");
    expect(output.secrets[0].preview).toContain("***");
  });

  it("generates analysis JSON and Markdown report into the run workspace and docs directory", () => {
    const projectDir = makeTempDir("vibeguard-skill-analysis-");
    const assetsDir = path.join(projectDir, ".vibeguard", "20260604-083000", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });
    const scanPath = path.join(assetsDir, "scan.json");
    fs.writeFileSync(
      scanPath,
      JSON.stringify({
        generated_at: "2026-06-04 08:30:00",
        scan_seconds: 1.5,
        project: {
          path: projectDir,
          name: path.basename(projectDir),
          ecosystems: ["npm"],
          lockfiles: ["package-lock.json"],
          git_repo: false,
          git_branch: null,
          total_packages: 1,
          total_vulnerabilities: 1,
        },
        hygiene: {
          gitignore_missing: [".env"],
          tracked_secrets: [
            {
              file: "src/config.ts",
              line: 3,
              type: "generic_password",
              confidence: "medium",
              preview: 'password = "***"',
            },
          ],
          sensitive_tracked: [],
        },
        vulnerabilities: [
          {
            package: "next",
            version: "15.5.1",
            ecosystem: "npm",
            severity: "high",
            advisory_id: "GHSA-test-test-test",
            aliases: ["GHSA-test-test-test"],
            fixed_versions: ["15.5.2"],
          },
        ],
        outdated: [],
        errors: [],
      }),
    );

    runPython([analyzePath, scanPath]);
    const analysisPath = path.join(assetsDir, "analysis.json");
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    expect(analysis.risk_summary.high).toBe(1);
    expect(analysis.risk_summary.medium).toBe(1);
    expect(analysis.top_issues).toHaveLength(1);
    expect(analysis.summary.priority.length).toBeGreaterThan(0);

    runPython([renderMarkdownPath, analysisPath]);
    const reportPath = path.join(projectDir, "docs", "security-report-2026-06-04.md");
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.readFileSync(reportPath, "utf8")).toContain("## 命中漏洞");
  });

  it("keeps same-package vulnerability summaries tied to each advisory", () => {
    const projectDir = makeTempDir("vibeguard-skill-advisory-summary-");
    const assetsDir = path.join(projectDir, ".vibeguard", "20260604-091500", "assets");
    fs.mkdirSync(assetsDir, { recursive: true });
    const scanPath = path.join(assetsDir, "scan.json");
    fs.writeFileSync(
      scanPath,
      JSON.stringify({
        generated_at: "2026-06-04 09:15:00",
        scan_seconds: 1.1,
        project: {
          path: projectDir,
          name: path.basename(projectDir),
          ecosystems: ["npm"],
          lockfiles: ["package-lock.json"],
          git_repo: false,
          git_branch: null,
          total_packages: 1,
          total_vulnerabilities: 2,
        },
        hygiene: {
          gitignore_missing: [],
          tracked_secrets: [],
          sensitive_tracked: [],
        },
        vulnerabilities: [
          {
            package: "next",
            version: "16.2.4",
            ecosystem: "npm",
            severity: "critical",
            advisory_id: "GHSA-ssrf-test",
            summary:
              "Next.js vulnerable to server-side request forgery in applications using WebSocket upgrades",
            fixed_versions: ["16.2.5"],
          },
          {
            package: "next",
            version: "16.2.4",
            ecosystem: "npm",
            severity: "critical",
            advisory_id: "GHSA-dos-test",
            summary: "Next.js has a Denial of Service in the Image Optimization API",
            fixed_versions: ["16.2.5"],
          },
        ],
        outdated: [],
        errors: [],
      }),
    );

    runPython([analyzePath, scanPath]);
    const analysisPath = path.join(assetsDir, "analysis.json");
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    const summaries = analysis.top_issues.map((item: { summary: string }) => item.summary);

    expect(analysis.top_issues).toHaveLength(2);
    expect(summaries[0]).not.toBe(summaries[1]);
    expect(summaries.join("\n")).toContain("服务端请求伪造");
    expect(summaries.join("\n")).toContain("Image Optimization API");
    expect(summaries.join("\n")).not.toContain("可能影响服务安全或稳定性");
  });

  it("runs the full one-command audit pipeline in hygiene-only mode", () => {
    const projectDir = makeTempDir("vibeguard-skill-run-audit-");
    const workflowDir = path.join(projectDir, ".github", "workflows");
    fs.mkdirSync(workflowDir, { recursive: true });
    fs.writeFileSync(
      path.join(workflowDir, "deploy.yml"),
      'env:\n  password = "shortpass"\n',
    );

    const result = runPython([
      runAuditPath,
      "--no-root-discovery",
      "--compact",
      projectDir,
    ]);
    const summary = JSON.parse(result.stdout);

    expect(summary.scan_mode).toBe("hygiene_only");
    expect(fs.existsSync(summary.preflight_file)).toBe(true);
    expect(fs.existsSync(summary.scan_file)).toBe(true);
    expect(fs.existsSync(summary.analysis_file)).toBe(true);
    expect(fs.existsSync(summary.markdown_report)).toBe(true);
    expect(fs.existsSync(summary.html_report)).toBe(true);
    expect(summary.risk_summary.medium).toBe(1);

    const scan = JSON.parse(fs.readFileSync(summary.scan_file, "utf8"));
    expect(scan.hygiene.tracked_secrets[0].preview).toContain("***");
    expect(scan.hygiene.tracked_secrets[0].preview).not.toContain("shortpass");
  });

  it("keeps HTML report links restricted to http and https URLs", () => {
    const template = fs.readFileSync(templatePath, "utf8");
    const reportJs = fs.readFileSync(reportJsPath, "utf8");

    expect(template).toContain("__REPORT_JS__");
    expect(reportJs).toContain("function safeHref");
    expect(reportJs).toContain('["http:", "https:"]');
    expect(reportJs).toContain("safeHref(link.url)");
    expect(reportJs).toContain("return linkHtml");
  });
});
