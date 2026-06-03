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

function makeExecutable(dir: string, name: string) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, "#!/bin/sh\nexit 0\n");
  fs.chmodSync(filePath, 0o755);
  return filePath;
}

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
  it("detects supported dependency files and the scoped Linux package managers", () => {
    const dir = makeTempDir("vibeguard-preflight-");
    const binDir = makeTempDir("vibeguard-bin-");
    const osRelease = path.join(dir, "os-release");

    fs.writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    fs.writeFileSync(
      osRelease,
      'ID=ubuntu\nID_LIKE=debian\nVERSION_ID="24.04"\nPRETTY_NAME="Ubuntu 24.04 LTS"\n',
    );
    makeExecutable(binDir, "apt");
    makeExecutable(binDir, "nix");
    makeExecutable(binDir, "zypper");

    const preflight = runPreflight(dir, [
      "--platform",
      "linux",
      "--os-release-file",
      osRelease,
      "--path-env",
      binDir,
    ]);

    expect(preflight.language_support.supported).toBe(true);
    expect(preflight.language_support.ecosystems).toEqual(["pnpm"]);
    expect(preflight.language_support.matched_files).toEqual([
      { ecosystem: "pnpm", file: "pnpm-lock.yaml" },
    ]);
    expect(preflight.language_support).not.toHaveProperty("supported_languages");
    expect(preflight.language_support).not.toHaveProperty("supported_files");
    expect(preflight.language_support).not.toHaveProperty("unsupported_reason");
    expect(preflight.recommended_scan_mode).toBe("full_dependency_scan");
    expect(preflight.os).toMatchObject({
      family: "linux",
      distro_id: "ubuntu",
      distro_id_like: "debian",
      name: "Ubuntu 24.04 LTS",
      version: "24.04",
    });
    expect(preflight.package_managers.map((pm: { name: string }) => pm.name)).toEqual([
      "apt",
      "dnf",
      "yum",
      "pacman",
      "apk",
      "nix",
    ]);
    expect(
      preflight.package_managers.filter((pm: { available: boolean }) => pm.available).map(
        (pm: { name: string }) => pm.name,
      ),
    ).toEqual(["apt", "nix"]);
    expect(preflight.package_managers.some((pm: { name: string }) => pm.name === "zypper"))
      .toBe(false);
  });

  it("falls back to hygiene-only mode and ignores MacPorts on macOS", () => {
    const dir = makeTempDir("vibeguard-preflight-");
    const binDir = makeTempDir("vibeguard-bin-");
    makeExecutable(binDir, "brew");
    makeExecutable(binDir, "port");
    makeExecutable(binDir, "softwareupdate");

    const preflight = runPreflight(dir, [
      "--platform",
      "macos",
      "--path-env",
      binDir,
    ]);

    expect(preflight.language_support.supported).toBe(false);
    expect(preflight.language_support).toEqual({
      supported: false,
      ecosystems: [],
      matched_files: [],
    });
    expect(preflight.recommended_scan_mode).toBe("hygiene_only");
    expect(preflight.package_managers).toEqual([
      {
        name: "brew",
        available: true,
        path: path.join(binDir, "brew"),
        update_check_command: ["brew", "outdated"],
      },
    ]);
    expect(preflight.package_managers.some((pm: { name: string }) => pm.name === "port"))
      .toBe(false);
    expect(preflight.system_update_tools).toEqual([
      {
        name: "softwareupdate",
        available: true,
        path: path.join(binDir, "softwareupdate"),
        update_check_command: ["softwareupdate", "--list"],
      },
    ]);
    expect(preflight).not.toHaveProperty("future_checks");
  });

  it("detects only winget and scoop on Windows", () => {
    const dir = makeTempDir("vibeguard-preflight-");
    const binDir = makeTempDir("vibeguard-bin-");
    makeExecutable(binDir, "winget");
    makeExecutable(binDir, "scoop");
    makeExecutable(binDir, "choco");

    const preflight = runPreflight(dir, [
      "--platform",
      "windows",
      "--path-env",
      binDir,
    ]);

    expect(preflight.os.family).toBe("windows");
    expect(preflight.package_managers.map((pm: { name: string }) => pm.name)).toEqual([
      "winget",
      "scoop",
    ]);
    expect(
      preflight.package_managers.every((pm: { available: boolean }) => pm.available),
    ).toBe(true);
    expect(preflight.package_managers.some((pm: { name: string }) => pm.name === "choco"))
      .toBe(false);
  });

  it("uses a local .vibeguard workspace for default output paths", () => {
    const dir = makeTempDir("vibeguard-preflight-");

    const preflight = runPreflightWithoutOutput(dir, ["--platform", "windows"], {});

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
