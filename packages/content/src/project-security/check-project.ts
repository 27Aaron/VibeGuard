export async function checkProjectDependenciesAgainstLocalDb(
  db: unknown,
  input: { rootDir: string },
): Promise<never> {
  void db
  void input

  throw new Error("checkProjectDependenciesAgainstLocalDb is not implemented yet.")
}
