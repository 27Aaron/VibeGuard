import { pathToFileURL } from "node:url"

/**
 * Returns true when the current module is the entry point of the Node.js process.
 * Extracted from sync-osv.ts and index.ts to avoid duplication (I18).
 */
export function isDirectExecution(moduleUrl: string): boolean {
  return (
    typeof process.argv[1] === "string" &&
    moduleUrl === pathToFileURL(process.argv[1]).href
  )
}
