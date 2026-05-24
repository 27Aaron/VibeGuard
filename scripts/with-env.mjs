import { spawn } from "node:child_process";
import path from "node:path";

import { applyLocalEnvDefaults, loadRootEnv } from "./load-env.mjs";

const rootDir = loadRootEnv();
const rawArgs = process.argv.slice(2);
const useLocalDefaults = rawArgs[0] === "--local-defaults";
const [command, ...args] = useLocalDefaults ? rawArgs.slice(1) : rawArgs;

if (useLocalDefaults) {
  applyLocalEnvDefaults();
}

if (!command) {
  console.error("[with-env] Missing command.");
  process.exit(1);
}

const resolvedCommand =
  process.platform === "win32" && command === "pnpm" ? "pnpm.cmd" : command;
const env = {
  ...process.env,
  PATH: [path.join(rootDir, "node_modules", ".bin"), process.env.PATH]
    .filter(Boolean)
    .join(path.delimiter),
  NODE_OPTIONS: process.env.NODE_OPTIONS || undefined,
};
const child = spawn(resolvedCommand, args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error(`[with-env] Failed to start ${command}.`);
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
