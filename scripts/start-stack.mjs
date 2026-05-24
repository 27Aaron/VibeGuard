import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadRootEnv } from "./load-env.mjs";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

loadRootEnv({ rootDir });

const webPort = process.env.PORT ?? "3000";
const webHost = process.env.VIBEGUARD_BIND_HOST ?? "0.0.0.0";
const children = new Set();
let shuttingDown = false;

function runCommand(label, command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`[start:stack] ${label}...`);

    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${label} failed${signal ? ` with signal ${signal}` : ` with code ${code ?? 1}`}`,
        ),
      );
    });
  });
}

async function bootstrapDatabase() {
  if (process.env.VIBEGUARD_SKIP_DB_BOOTSTRAP === "true") {
    console.log("[start:stack] Skipping database bootstrap.");
    return;
  }

  await runCommand("Applying database migrations", "node", [
    "scripts/migrate.mjs",
  ], {
    cwd: path.join(rootDir, "packages/db"),
  });
}

function spawnService(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    ...options,
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);

    if (shuttingDown) {
      return;
    }

    const exitCode = code ?? (signal ? 1 : 0);
    console.error(
      `[start:stack] ${name} exited${signal ? ` with signal ${signal}` : ` with code ${exitCode}`}.`,
    );
    shutdown("SIGTERM");
    process.exit(exitCode);
  });

  return child;
}

function shutdown(signal) {
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on("SIGINT", () => {
  shutdown("SIGINT");
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
  process.exit(0);
});

await bootstrapDatabase();

spawnService("web", "node", ["server.js"], {
  cwd: path.join(rootDir, "apps/web"),
  env: {
    ...process.env,
    HOSTNAME: webHost,
    PORT: webPort,
  },
});

spawnService("worker", "node", ["--import", "tsx", "src/index.ts"], {
  cwd: path.join(rootDir, "apps/worker"),
});
