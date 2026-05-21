import { closeDb, getDb } from "@vibeguard/db"
import { syncAllOsvEcosystems } from "@vibeguard/content/osv/sync"

function parseLimit(argv: string[]) {
  const limitArg = argv.find((arg) => arg.startsWith("--limit="))

  if (!limitArg) {
    return 20
  }

  const parsed = Number.parseInt(limitArg.slice("--limit=".length), 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("--limit must be a positive integer")
  }

  return parsed
}

export async function main(argv = process.argv.slice(2)) {
  const limit = parseLimit(argv)

  try {
    const results = await syncAllOsvEcosystems({
      db: getDb(),
      limit,
    })

    for (const result of results) {
      console.log(
        [
          `osv sync ${result.ecosystem}`,
          `seen=${result.recordsSeen}`,
          `imported=${result.recordsImported}`,
          `failed=${result.recordsFailed}`,
        ].join(" "),
      )
    }
  } finally {
    await closeDb()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
