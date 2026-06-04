import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve("skill/vibeguard/scripts/preflight.py");
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

function runPreflight(projectDir: string, args: string[]) {
  const outputPath = path.join(projectDir, "preflight.json");
  const result = spawnSync(
    process.env.PYTHON ?? "python3",
    [scriptPath, "--no-root-discovery", "--output", outputPath, ...args, projectDir],
    { encoding: "utf8" },
  );

  expect(result.status, result.stderr || result.stdout).toBe(0);
  const stdoutJson = JSON.parse(result.stdout);
  const fileJson = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  expect(fileJson).toEqual(stdoutJson);
  expect(stdoutJson.output_file).toBe(outputPath);
  return stdoutJson;
}

function runPreflightWithoutOutput(projectDir: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(
    process.env.PYTHON ?? "python3",
    [scriptPath, "--no-root-discovery", ...args, projectDir],
    {
      encoding: "utf8",
      env: { ...process.env, ...env },
    },
  );

  expect(result.status, result.stderr || result.stdout).toBe(0);
  return JSON.parse(result.stdout);
}

describe("VibeGuard preflight", () => {
  it("detects supported dependency files without system or package-manager probes", () => {
    const dir = makeTempDir("vibeguard-preflight-");

    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");

    const preflight = runPreflight(dir, []);

    expect(preflight.language_support.supported).toBe(true);
    expect(preflight.language_support.ecosystems).toEqual(["pnpm"]);
    expect(preflight.language_support.matched_files).toEqual([
      { ecosystem: "pnpm", file: "pnpm-lock.yaml" },
    ]);
    expect(preflight.language_support).not.toHaveProperty("supported_languages");
    expect(preflight.language_support).not.toHaveProperty("supported_files");
    expect(preflight.language_support).not.toHaveProperty("unsupported_reason");
    expect(preflight.recommended_scan_mode).toBe("full_dependency_scan");
    expect(preflight).not.toHaveProperty("os");
    expect(preflight).not.toHaveProperty("package_managers");
    expect(preflight).not.toHaveProperty("system_update_tools");
  });

  it("falls back to hygiene-only mode without package-manager metadata", () => {
    const dir = makeTempDir("vibeguard-preflight-");

    const preflight = runPreflight(dir, []);

    expect(preflight.language_support.supported).toBe(false);
    expect(preflight.language_support).toEqual({
      supported: false,
      ecosystems: [],
      matched_files: [],
    });
    expect(preflight.recommended_scan_mode).toBe("hygiene_only");
    expect(preflight).not.toHaveProperty("os");
    expect(preflight).not.toHaveProperty("package_managers");
    expect(preflight).not.toHaveProperty("system_update_tools");
    expect(preflight).not.toHaveProperty("future_checks");
  });

  it("does not expose deprecated platform probe fields", () => {
    const dir = makeTempDir("vibeguard-preflight-");

    const preflight = runPreflight(dir, []);

    expect(preflight).not.toHaveProperty("os");
    expect(preflight).not.toHaveProperty("package_managers");
    expect(preflight).not.toHaveProperty("system_update_tools");
    expect(JSON.stringify(preflight)).not.toContain("update_check_command");
  });

  it("uses a local .vibeguard workspace for default output paths", () => {
    const dir = makeTempDir("vibeguard-preflight-");

    const preflight = runPreflightWithoutOutput(dir, [], {});

    const relativeOutput = path.relative(dir, preflight.output_file).split(path.sep);
    expect(relativeOutput).toEqual([
      ".vibeguard",
      expect.stringMatching(/^\d{8}-\d{6}(?:-\d+)?$/),
      "assets",
      "preflight.json",
    ]);
    expect(fs.existsSync(preflight.output_file)).toBe(true);
    expect(
      fs.existsSync(path.join(dir, ".vibeguard", relativeOutput[1], "content")),
    ).toBe(true);
    expect(fs.readFileSync(path.join(dir, ".gitignore"), "utf8")).toContain(
      ".vibeguard/",
    );
  });
});
