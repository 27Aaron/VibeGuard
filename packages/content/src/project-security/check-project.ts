import type {
  CheckProjectDependenciesInput,
  CheckProjectDependenciesResult,
  ProjectSecurityDb,
} from "./types"

export async function checkProjectDependenciesAgainstLocalDb(
  db: ProjectSecurityDb,
  input: CheckProjectDependenciesInput,
): Promise<CheckProjectDependenciesResult> {
  void db
  void input

  throw new Error("checkProjectDependenciesAgainstLocalDb is not implemented yet.")
}
