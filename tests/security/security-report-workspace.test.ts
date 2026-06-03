import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const scriptsDir = path.resolve("skill/vibeguard/scripts");
const buildReportPath = path.join(scriptsDir, "build_report.py");
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

    const result = spawnSync(process.env.PYTHON ?? "python3", [buildReportPath, analysisPath], {
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const htmlPath = path.join(contentDir, "security-report.html");
    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(result.stdout).toContain(htmlPath);
    expect(result.stdout).not.toContain("Desktop");
    expect(result.stdout).not.toContain("127.0.0.1");
    expect(result.stdout).not.toContain("open '");
    expect(result.stdout).toContain("如果你想继续处理修复");
    expect(result.stdout).toContain("可以修 / 修复 / OK / Yes");
  });

  it("prints a static report path without requiring a local server", () => {
    const projectDir = makeTempDir("vibeguard-report-project-");
    const { analysisPath, contentDir } = writeAnalysis(projectDir);

    const result = spawnSync(process.env.PYTHON ?? "python3", [buildReportPath, analysisPath], {
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain(path.join(contentDir, "security-report.html"));
    expect(result.stdout).toContain("HTML 已保存");
    expect(result.stdout).not.toContain("server");
  });
});
