/**
 * MCP 工具定义的共享常量。
 *
 * 这些数组排除了 "unknown"，因为 MCP 工具的参数应仅提供具体的生态系统/风险类别
 * 值。"unknown" 是分类管道内部使用的兜底值，不应作为用户可选的过滤条件。
 */

export const MCP_ECOSYSTEMS = [
  "npm",
  "pypi",
  "maven",
  "go",
  "crates-io",
  "github-actions",
  "docker",
  "multi",
] as const;

export const MCP_RISK_CATEGORIES = [
  "vulnerability",
  "exploit-activity",
  "malicious-package",
  "supply-chain-attack",
  "dependency-risk",
] as const;

export const MCP_CHECK_ECOSYSTEMS = ["npm", "pypi", "go", "crates-io"] as const;
