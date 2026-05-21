import { checkPackagesAgainstLocalDb } from "../osv/query"
import { scanDependencies } from "./scan-dependencies"
import type {
  CheckProjectDependenciesInput,
  CheckProjectDependenciesResult,
  PackageCheckResult,
  ProjectSecurityDb,
  ScanDependenciesInput,
  ScanDependenciesResult,
} from "./types"

type CheckProjectDependenciesDeps = {
  scanDependencies: (
    input: ScanDependenciesInput,
  ) => Promise<ScanDependenciesResult>
  checkPackagesAgainstLocalDb: (
    db: ProjectSecurityDb,
    input: {
      packages: {
        ecosystem: ScanDependenciesResult["packages"][number]["ecosystem"]
        name: string
        version?: string | null
      }[]
    },
  ) => Promise<PackageCheckResult>
}

const defaultDeps: CheckProjectDependenciesDeps = {
  scanDependencies,
  checkPackagesAgainstLocalDb,
}

function buildForwardedPackageKey(
  pkg: ScanDependenciesResult["packages"][number],
) {
  return `${pkg.ecosystem}\u0000${pkg.name}\u0000${pkg.version ?? ""}`
}

function dedupeForwardedPackages(
  packages: ScanDependenciesResult["packages"],
) {
  const seen = new Set<string>()

  return packages.flatMap((pkg) => {
    const key = buildForwardedPackageKey(pkg)

    if (seen.has(key)) {
      return []
    }

    seen.add(key)

    return {
      ecosystem: pkg.ecosystem,
      name: pkg.name,
      version: pkg.version,
    }
  })
}

export async function checkProjectDependenciesAgainstLocalDb(
  db: ProjectSecurityDb,
  input: CheckProjectDependenciesInput,
  deps: CheckProjectDependenciesDeps = defaultDeps,
): Promise<CheckProjectDependenciesResult> {
  const dependencyScan = await deps.scanDependencies({ rootDir: input.rootDir })
  const packageCheck = await deps.checkPackagesAgainstLocalDb(db, {
    packages: dedupeForwardedPackages(dependencyScan.packages),
  })

  return {
    meta: packageCheck.meta,
    files: dependencyScan.files,
    dependencies: dependencyScan.packages,
    warnings: dependencyScan.warnings,
    findings: packageCheck.findings,
  }
}
