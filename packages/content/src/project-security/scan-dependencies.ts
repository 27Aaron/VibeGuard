import type { ScanDependenciesResult } from "./types"

export async function scanDependencies(input: {
  rootDir: string
}): Promise<ScanDependenciesResult> {
  void input

  throw new Error("scanDependencies is not implemented yet.")
}
