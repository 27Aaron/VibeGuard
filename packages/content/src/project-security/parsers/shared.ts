import type { ResolvedDependency } from "../types"

export function toSortedPackages(packages: ResolvedDependency[]) {
  return [...packages].sort((left, right) => {
    const nameComparison = left.name.localeCompare(right.name)
    if (nameComparison !== 0) {
      return nameComparison
    }

    return (left.version ?? "").localeCompare(right.version ?? "")
  })
}
