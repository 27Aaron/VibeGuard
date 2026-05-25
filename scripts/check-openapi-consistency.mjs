#!/usr/bin/env node

/**
 * Validates structural consistency across three OpenAPI spec files:
 *   - openapi.yaml       (base / zh)
 *   - openapi.zh.yaml    (zh)
 *   - openapi.en.yaml    (en)
 *
 * Checks that all three files share:
 *   1. The same set of paths and HTTP methods
 *   2. The same operation IDs (mapped to the same path+method)
 *   3. The same schema / response names under components
 *
 * Exits 0 if consistent, 1 if differences are found.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parse: parseYaml } = require("yaml");

const __dirname = dirname(fileURLToPath(import.meta.url));
const specsDir = join(__dirname, "..", "apps", "web", "public");

const FILES = ["openapi.yaml", "openapi.zh.yaml", "openapi.en.yaml"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Load and parse a YAML file. */
function loadSpec(filename) {
  const raw = readFileSync(join(specsDir, filename), "utf-8");
  return parseYaml(raw);
}

/**
 * Extract a flat map of { "METHOD /path": operationId } from a spec.
 * Also returns the list of entries in insertion order for clearer diffs.
 */
function extractOperations(spec) {
  const map = {};
  if (!spec.paths) return { map };

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const method of ["get", "post", "put", "patch", "delete", "head", "options", "trace"]) {
      if (methods[method]) {
        const key = `${method.toUpperCase()} ${path}`;
        map[key] = methods[method].operationId ?? null;
      }
    }
  }
  return { map };
}

/**
 * Extract schema names from components/schemas and components/responses.
 */
function extractComponentNames(spec) {
  const schemas = spec.components?.schemas ? Object.keys(spec.components.schemas) : [];
  const responses = spec.components?.responses ? Object.keys(spec.components.responses) : [];
  return { schemas: [...schemas].sort(), responses: [...responses].sort() };
}

/** Return items present in `a` but not in `b`. */
function missing(a, b) {
  const setB = new Set(b);
  return a.filter((x) => !setB.has(x));
}

/** Pretty-print a list of differences. */
function formatList(items) {
  if (items.length === 0) return "(none)";
  return items.map((x) => `  - ${x}`).join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const specs = FILES.map((f) => {
    try {
      return { file: f, spec: loadSpec(f) };
    } catch (err) {
      console.error(`Failed to load ${f}: ${err.message}`);
      process.exit(1);
    }
  });

  // Use the first file (openapi.yaml) as the baseline.
  const [base, ...others] = specs;
  let hasErrors = false;

  // ---- 1. Paths & HTTP methods ----
  console.log("=== Paths & HTTP methods ===\n");

  const baseOps = extractOperations(base.spec);

  for (const other of others) {
    const otherOps = extractOperations(other.spec);
    const baseKeys = Object.keys(baseOps.map);
    const otherKeys = Object.keys(otherOps.map);

    const onlyInBase = missing(baseKeys, otherKeys);
    const onlyInOther = missing(otherKeys, baseKeys);

    if (onlyInBase.length === 0 && onlyInOther.length === 0) {
      console.log(`${other.file}: OK (same paths & methods)`);
    } else {
      hasErrors = true;
      console.log(`${other.file}: MISMATCH`);
      if (onlyInBase.length) {
        console.log(`  Only in ${base.file}:\n${formatList(onlyInBase)}`);
      }
      if (onlyInOther.length) {
        console.log(`  Only in ${other.file}:\n${formatList(onlyInOther)}`);
      }
    }
  }

  // ---- 2. Operation IDs ----
  console.log("\n=== Operation IDs ===\n");

  for (const other of others) {
    const bOps = extractOperations(base.spec);
    const oOps = extractOperations(other.spec);

    const mismatches = [];
    const allKeys = new Set([...Object.keys(bOps.map), ...Object.keys(oOps.map)]);

    for (const key of allKeys) {
      const bId = bOps.map[key];
      const oId = oOps.map[key];
      if (bId !== oId) {
        mismatches.push(`${key}: ${base.file}=${bId ?? "<missing>"}, ${other.file}=${oId ?? "<missing>"}`);
      }
    }

    if (mismatches.length === 0) {
      console.log(`${other.file}: OK (all operationIds match)`);
    } else {
      hasErrors = true;
      console.log(`${other.file}: MISMATCH`);
      for (const m of mismatches) {
        console.log(`  - ${m}`);
      }
    }
  }

  // ---- 3. Component schemas & responses ----
  console.log("\n=== Component schemas ===\n");

  const baseComponents = extractComponentNames(base.spec);

  for (const other of others) {
    const oComp = extractComponentNames(other.spec);

    const schemaOnlyInBase = missing(baseComponents.schemas, oComp.schemas);
    const schemaOnlyInOther = missing(oComp.schemas, baseComponents.schemas);

    const respOnlyInBase = missing(baseComponents.responses, oComp.responses);
    const respOnlyInOther = missing(oComp.responses, baseComponents.responses);

    if (
      schemaOnlyInBase.length === 0 &&
      schemaOnlyInOther.length === 0 &&
      respOnlyInBase.length === 0 &&
      respOnlyInOther.length === 0
    ) {
      console.log(`${other.file}: OK (same schemas & responses)`);
    } else {
      hasErrors = true;
      console.log(`${other.file}: MISMATCH`);
      if (schemaOnlyInBase.length) {
        console.log(`  Schemas only in ${base.file}:\n${formatList(schemaOnlyInBase)}`);
      }
      if (schemaOnlyInOther.length) {
        console.log(`  Schemas only in ${other.file}:\n${formatList(schemaOnlyInOther)}`);
      }
      if (respOnlyInBase.length) {
        console.log(`  Responses only in ${base.file}:\n${formatList(respOnlyInBase)}`);
      }
      if (respOnlyInOther.length) {
        console.log(`  Responses only in ${other.file}:\n${formatList(respOnlyInOther)}`);
      }
    }
  }

  // ---- Summary ----
  console.log("\n" + (hasErrors ? "FAIL: structural inconsistencies found." : "PASS: all specs are structurally consistent."));

  process.exit(hasErrors ? 1 : 0);
}

main();
