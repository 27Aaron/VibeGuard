import fs from "node:fs"

import { describe, expect, it } from "vitest"

const ACTION_FILES = [
  "apps/web/lib/actions/articles.ts",
  "apps/web/lib/actions/feeds.ts",
  "apps/web/lib/actions/jobs.ts",
  "apps/web/lib/actions/settings.ts",
  "apps/web/lib/actions/worker.ts",
]

function findTryBlocks(source: string) {
  const blocks: string[] = []
  let cursor = 0

  while (cursor < source.length) {
    const tryIndex = source.indexOf("try", cursor)

    if (tryIndex === -1) {
      break
    }

    const before = source[tryIndex - 1] ?? ""
    const after = source[tryIndex + 3] ?? ""

    if (/\w/.test(before) || /\w/.test(after)) {
      cursor = tryIndex + 3
      continue
    }

    const openBrace = source.indexOf("{", tryIndex)

    if (openBrace === -1) {
      break
    }

    let depth = 0

    for (let index = openBrace; index < source.length; index += 1) {
      const char = source[index]

      if (char === "{") {
        depth += 1
      }

      if (char === "}") {
        depth -= 1
      }

      if (depth === 0) {
        blocks.push(source.slice(openBrace + 1, index))
        cursor = index + 1
        break
      }
    }
  }

  return blocks
}

describe("server action redirect control flow", () => {
  it("keeps Next redirect calls outside try blocks that have catch handlers", () => {
    const offenders = ACTION_FILES.flatMap((filePath) => {
      const source = fs.readFileSync(filePath, "utf8")
      return findTryBlocks(source)
        .filter((block) => block.includes("redirect("))
        .map(() => filePath)
    })

    expect(offenders).toEqual([])
  })
})
