/**
 * Shared constants for MCP tool definitions.
 *
 * These arrays exclude "unknown" because MCP tool parameters should only
 * offer concrete ecosystem/risk-category values — "unknown" is a fallback
 * used internally by the classification pipeline, not a valid user filter.
 */

export const MCP_ECOSYSTEMS = ["npm", "pypi", "maven", "go", "crates-io", "github-actions", "docker", "multi"] as const

export const MCP_RISK_CATEGORIES = ["vulnerability", "exploit-activity", "malicious-package", "supply-chain-attack", "dependency-risk"] as const

export const MCP_CHECK_ECOSYSTEMS = ["npm", "pypi", "go", "crates-io"] as const
