import { spawn } from "node:child_process";
import net from "node:net";

import { applyLocalEnvDefaults, loadRootEnv } from "./load-env.mjs";

loadRootEnv();
applyLocalEnvDefaults();

const packageManagerCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const webPort = Number(process.env.PORT ?? "3000");
const webHost = process.env.HOSTNAME ?? "127.0.0.1";

const sharedEnv = {
  ...process.env,
};

const processes = [
  {
    name: "web",
    cmd: packageManagerCommand,
    args: ["dev:web"],
    env: {
      PORT: String(webPort),
      HOSTNAME: webHost,
    },
  },
  {
    name: "worker",
    cmd: packageManagerCommand,
    args: ["dev:worker"],
  },
];

function isPortInUse(port, host) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(true);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(false));
    });

    server.listen(port, host);
  });
}

function runCommand(label, cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`[dev:stack] ${label}...`);
    const child = spawn(cmd, args, {
      cwd: process.cwd(),
      env: sharedEnv,
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
    console.log("[dev:stack] 跳过数据库自举：VIBEGUARD_SKIP_DB_BOOTSTRAP=true");
    return;
  }

  await runCommand("应用数据库迁移（创建/更新表）", packageManagerCommand, [
    "db:migrate",
  ]);
}

async function main() {
  if (await isPortInUse(webPort, webHost)) {
    console.error(
      `[dev:stack] ${webHost}:${webPort} 已被占用。请先释放这个端口，再重新执行 pnpm dev:stack。`,
    );
    console.error(
      `[dev:stack] 常见场景是旧的 Next.js 进程还挂着，或者你打开了一个旧的 3000 页面。`,
    );
    process.exit(1);
  }

  await bootstrapDatabase();

  const children = processes.map((proc) => {
    const child = spawn(proc.cmd, proc.args, {
      cwd: process.cwd(),
      env: {
        ...sharedEnv,
        ...proc.env,
      },
      stdio: "inherit",
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        console.log(`[${proc.name}] exited with signal ${signal}`);
        return;
      }

      console.log(`[${proc.name}] exited with code ${code ?? 0}`);
    });

    return child;
  });

  function shutdown(signal) {
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
}

main().catch((error) => {
  console.error("[dev:stack] 启动失败。");
  console.error(error);
  process.exit(1);
});
