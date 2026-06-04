import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve("skill/vibeguard/scripts/scan.py");
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

function runScan(args: string[], env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(process.env.PYTHON ?? "python3", [scriptPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });

  expect(result.status, result.stderr || result.stdout).toBe(0);
  return JSON.parse(result.stdout);
}

describe("VibeGuard scan preflight integration", () => {
  it("fills outdated current versions from parsed lockfile packages", () => {
    const snippet = `
import importlib.util
import json
import pathlib

script = pathlib.Path(${JSON.stringify(scriptPath)})
spec = importlib.util.spec_from_file_location("vibeguard_scan", script)
scan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scan)

scan.run_cmd_checked = lambda *args, **kwargs: json.dumps({
    "@base-ui/react": {"latest": "1.5.0"},
    "bcryptjs": {"latest": "3.0.3"},
})
items = scan.check_outdated(
    "/tmp/project",
    ["npm"],
    concurrency=1,
    packages=[
        {
            "ecosystem": "npm",
            "name": "@base-ui/react",
            "version": "1.4.0",
        },
        {
            "ecosystem": "npm",
            "name": "bcryptjs",
            "version": "3.0.3",
        }
    ],
)
print(json.dumps(items, ensure_ascii=False))
`;
    const result = spawnSync(process.env.PYTHON ?? "python3", ["-c", snippet], {
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      {
        package: "@base-ui/react",
        current: "1.4.0",
        wanted: "",
        latest: "1.5.0",
        ecosystem: "npm",
      },
    ]);
  });

  it("reuses preflight project path and writes scan JSON to .vibeguard", () => {
    const projectDir = makeTempDir("vibeguard-scan-project-");
    const runDir = path.join(projectDir, ".vibeguard", "20260604-070000");
    const assetsDir = path.join(runDir, "assets");
    const contentDir = path.join(runDir, "content");
    fs.mkdirSync(assetsDir, { recursive: true });
    const preflightPath = path.join(assetsDir, "preflight.json");
    fs.writeFileSync(
      preflightPath,
      JSON.stringify({
        project: {
          path: projectDir,
          name: path.basename(projectDir),
        },
        language_support: {
          supported: false,
          ecosystems: [],
          matched_files: [],
        },
        recommended_scan_mode: "hygiene_only",
        output_file: preflightPath,
      }),
    );

    const scan = runScan(["--preflight", preflightPath]);

    expect(scan.project.path).toBe(projectDir);
    expect(scan.project.total_packages).toBe(0);
    expect(scan.project.total_vulnerabilities).toBe(0);
    expect(scan.scan_config.preflight_file).toBe(preflightPath);
    expect(scan.scan_config.scan_mode).toBe("hygiene_only");
    expect(scan.scan_config.skip_dependency_checks).toBe(true);
    expect(scan.output_file).toBe(path.join(assetsDir, "scan.json"));
    expect(JSON.parse(fs.readFileSync(scan.output_file, "utf8"))).toEqual(scan);
    expect(fs.existsSync(contentDir)).toBe(true);
    expect(fs.readFileSync(path.join(projectDir, ".gitignore"), "utf8")).toContain(
      ".vibeguard/",
    );
    expect(scan.vulnerabilities).toEqual([]);
    expect(scan.outdated).toEqual([]);
  });

  it("uses one API request at a time while keeping non-API defaults bounded", () => {
    const projectDir = makeTempDir("vibeguard-scan-project-");
    const scan = runScan(["--no-root-discovery", projectDir]);
    const cpuCount = os.cpus().length || 4;
    const relativeOutput = path.relative(projectDir, scan.output_file).split(path.sep);

    expect(scan.scan_config.api_concurrency).toBe(1);
    expect(scan.scan_config.outdated_concurrency).toBe(Math.max(1, Math.min(cpuCount, 8)));
    expect(relativeOutput).toEqual([
      ".vibeguard",
      expect.stringMatching(/^\d{8}-\d{6}(?:-\d+)?$/),
      "assets",
      "scan.json",
    ]);
  });
});
