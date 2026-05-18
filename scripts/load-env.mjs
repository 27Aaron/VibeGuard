import fs from "node:fs";
import path from "node:path";

function findProjectRoot(startDir = process.cwd()) {
  let currentDir = startDir;

  while (true) {
    if (
      fs.existsSync(path.join(currentDir, "package.json")) &&
      fs.existsSync(path.join(currentDir, "pnpm-workspace.yaml"))
    ) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);

    if (parentDir === currentDir) {
      return startDir;
    }

    currentDir = parentDir;
  }
}

function stripInlineComment(value) {
  const commentIndex = value.search(/\s#/);

  if (commentIndex === -1) {
    return value;
  }

  return value.slice(0, commentIndex).trimEnd();
}

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const normalized = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trimStart()
    : trimmed;
  const equalsIndex = normalized.indexOf("=");

  if (equalsIndex === -1) {
    return null;
  }

  const key = normalized.slice(0, equalsIndex).trim();
  let value = normalized.slice(equalsIndex + 1).trim();

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  } else {
    value = stripInlineComment(value);
  }

  value = value
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t");

  return [key, value];
}

function loadEnvFile(filePath, initialKeys) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const entry = parseEnvLine(line);

    if (!entry) {
      continue;
    }

    const [key, value] = entry;

    if (initialKeys.has(key)) {
      continue;
    }

    process.env[key] = value;
  }
}

export function loadRootEnv(options = {}) {
  const rootDir = options.rootDir ?? findProjectRoot();
  const initialKeys = new Set(Object.keys(process.env));

  loadEnvFile(path.join(rootDir, ".env"), initialKeys);
  loadEnvFile(path.join(rootDir, ".env.local"), initialKeys);

  return rootDir;
}

export function applyLocalEnvDefaults() {
  process.env.DATABASE_URL ??=
    "postgresql://postgres:postgres@127.0.0.1:5432/vibeguard";
  process.env.VIBEGUARD_SECRET ??=
    process.env.CONTENT_FOUNDATION_SECRET ?? "test-secret";
}
