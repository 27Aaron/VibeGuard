import fs from "node:fs";

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Source file paths
// ---------------------------------------------------------------------------
const schemaSource = fs.readFileSync("packages/db/src/schema.ts", "utf8");
const clientSource = fs.readFileSync("packages/db/src/client.ts", "utf8");
const indexSource = fs.readFileSync("apps/worker/src/index.ts", "utf8");
const syncOsvSource = fs.readFileSync("apps/worker/src/sync-osv.ts", "utf8");
const runUtilsSource = fs.readFileSync("apps/worker/src/run-utils.ts", "utf8");

// ===========================================================================
// 高写入表 UUID v7 优化注释
// ===========================================================================
describe("UUID v7 optimization opportunity noted", () => {
  it("schema.ts contains a comment mentioning UUID v7 for high-write tables", () => {
    expect(schemaSource).toMatch(/UUID v7/);
    expect(schemaSource).toMatch(/高写入/);
  });
});

// ===========================================================================
// feeds 启用轮询部分索引
// ===========================================================================
describe("Feeds polling uses a partial enabled index", () => {
  it("replaces the low-selectivity boolean-only index", () => {
    expect(schemaSource).not.toMatch(/feeds_enabled_idx/);
    expect(schemaSource).toMatch(/feeds_enabled_poll_idx/);
  });

  it("indexes lastPolledAt only for enabled feeds", () => {
    expect(schemaSource).toMatch(/\.on\(table\.lastPolledAt\)/);
    expect(schemaSource).toMatch(/\.where\(sql`\$\{table\.enabled\} = true`\)/);
  });
});

// ===========================================================================
// client.ts 单例模式文档注释
// ===========================================================================
describe("Singleton pattern documented", () => {
  it("client.ts has a comment about the singleton pattern and thread safety", () => {
    expect(clientSource).toMatch(/单例模式/);
    expect(clientSource).toMatch(/closeDb/);
    expect(clientSource).toMatch(/重新创建/);
  });
});

// ===========================================================================
// resolvePollInterval 跳过冗余的 String 转换
// ===========================================================================
describe("resolvePollInterval avoids redundant String conversion", () => {
  it("checks typeof before parseInt", () => {
    expect(indexSource).toMatch(/typeof value === "number"/);
  });

  it("no longer does unconditional String(value) then parseInt", () => {
    // The old pattern was: Number.parseInt(String(value), 10) — unconditional
    // The fix short-circuits when value is already a finite number.
    const resolveFn = indexSource.match(
      /function resolvePollInterval\([\s\S]*?\n\}/,
    );
    expect(resolveFn).not.toBeNull();

    // Should contain a type guard before falling back to parseInt
    expect(resolveFn![0]).toMatch(/typeof value/);
  });
});

// ===========================================================================
// MAX_BACKOFF_POWER 命名常量
// ===========================================================================
describe("Backoff power uses named constant", () => {
  it("index.ts defines MAX_BACKOFF_POWER constant", () => {
    expect(indexSource).toMatch(/const MAX_BACKOFF_POWER = 6/);
  });

  it("computeIdleInterval uses MAX_BACKOFF_POWER instead of magic 6", () => {
    const computeFn = indexSource.match(
      /function computeIdleInterval\([\s\S]*?\n\}/,
    );
    expect(computeFn).not.toBeNull();
    expect(computeFn![0]).toContain("MAX_BACKOFF_POWER");
    // The old magic number 6 should NOT appear directly in the expression
    expect(computeFn![0]).not.toMatch(/Math\.min\([^,]+,\s*6\)/);
  });
});

// ===========================================================================
// articleEcosystemValues / articleRiskCategoryValues 实际被使用
// ===========================================================================
describe("articleEcosystemValues and articleRiskCategoryValues usage", () => {
  it("articleEcosystemValues is used in articleEcosystemEnum pgEnum call", () => {
    // These are NOT unused — they are used in pgEnum() definitions
    expect(schemaSource).toContain("articleEcosystemValues,");
    // Verify it appears inside the pgEnum call for articleEcosystemEnum
    const enumBlock = schemaSource.match(
      /articleEcosystemEnum = pgEnum\([\s\S]*?\);/,
    );
    expect(enumBlock).not.toBeNull();
    expect(enumBlock![0]).toContain("articleEcosystemValues");
  });

  it("articleRiskCategoryValues is used in articleRiskCategoryEnum pgEnum call", () => {
    expect(schemaSource).toContain("articleRiskCategoryValues,");
    const enumBlock = schemaSource.match(
      /articleRiskCategoryEnum = pgEnum\([\s\S]*?\);/,
    );
    expect(enumBlock).not.toBeNull();
    expect(enumBlock![0]).toContain("articleRiskCategoryValues");
  });

  it("both are exported (used by tests and potentially external consumers)", () => {
    expect(schemaSource).toMatch(/export const articleEcosystemValues/);
    expect(schemaSource).toMatch(/export const articleRiskCategoryValues/);
  });
});

// ===========================================================================
// 模块级可变全局状态已文档化
// ===========================================================================
describe("Module-level mutable global state noted", () => {
  it("client.ts has a comment about module-level mutable globals", () => {
    expect(clientSource).toMatch(/可变全局变量/);
  });

  it("notes the testing difficulty", () => {
    expect(clientSource).toMatch(/难以在隔离环境中/);
    expect(clientSource).toMatch(/单元测试/);
  });
});

// ===========================================================================
// 重复的 isDirectExecution 提取为共享辅助函数
// ===========================================================================
describe("Shared isDirectExecution helper", () => {
  it("run-utils.ts exists and exports isDirectExecution", () => {
    expect(runUtilsSource).toMatch(/export function isDirectExecution/);
  });

  it("run-utils.ts uses pathToFileURL for the check", () => {
    expect(runUtilsSource).toMatch(/pathToFileURL/);
    expect(runUtilsSource).toMatch(/moduleUrl/);
  });

  it("index.ts imports isDirectExecution from run-utils", () => {
    expect(indexSource).toMatch(
      /import.*isDirectExecution.*from.*\.\/run-utils/,
    );
  });

  it("sync-osv.ts imports isDirectExecution from run-utils", () => {
    expect(syncOsvSource).toMatch(
      /import.*isDirectExecution.*from.*\.\/run-utils/,
    );
  });

  it("index.ts no longer has inline isDirectExecution definition", () => {
    // Should NOT contain the old pattern of defining isDirectExecution inline
    expect(indexSource).not.toMatch(
      /const isDirectExecution =\s*\n\s*typeof process\.argv/,
    );
  });

  it("sync-osv.ts no longer has inline isDirectExecution definition", () => {
    expect(syncOsvSource).not.toMatch(
      /const isDirectExecution =\s*\n\s*typeof process\.argv/,
    );
  });

  it("both files pass their module URL to isDirectExecution", () => {
    expect(indexSource).toMatch(/isDirectExecution\(import\.meta\.url\)/);
    expect(syncOsvSource).toMatch(/isDirectExecution\(import\.meta\.url\)/);
  });
});
