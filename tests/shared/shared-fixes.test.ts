import { describe, expect, it } from "vitest";

import { normalizeInt } from "@vibeguard/shared";

// ---------------------------------------------------------------------------
// W39: normalizeInt has no upper bound parameter
// W40: fallback could be less than minimum
// ---------------------------------------------------------------------------

describe("W39/W40 — normalizeInt maximum parameter and fallback clamping", () => {
  // --- W39: maximum parameter ---

  it("clamps parsed value to maximum when exceeded", () => {
    expect(normalizeInt("200", 10, 1, 100)).toBe(10); // 200 > 100, returns fallback
  });

  it("returns parsed value when within maximum", () => {
    expect(normalizeInt("50", 10, 1, 100)).toBe(50);
  });

  it("returns parsed value when exactly at maximum", () => {
    expect(normalizeInt("100", 10, 1, 100)).toBe(100);
  });

  it("works without maximum (backwards compatible)", () => {
    expect(normalizeInt("99999", 10, 1)).toBe(99999);
  });

  it("returns fallback when value exceeds maximum", () => {
    expect(normalizeInt("500", 25, 1, 100)).toBe(25);
  });

  // --- W40: fallback clamping ---

  it("clamps fallback to minimum when fallback < minimum", () => {
    // fallback=0 is below minimum=1, so should be clamped to 1
    expect(normalizeInt(undefined, 0, 1)).toBe(1);
  });

  it("clamps fallback to minimum when fallback is negative", () => {
    expect(normalizeInt(undefined, -5, 1)).toBe(1);
  });

  it("clamps fallback to maximum when fallback > maximum", () => {
    // fallback=200 exceeds maximum=100
    expect(normalizeInt(undefined, 200, 1, 100)).toBe(100);
  });

  it("uses clamped fallback when input is below minimum", () => {
    // input "0" < minimum 5, fallback 2 < minimum 5 => returns 5
    expect(normalizeInt("0", 2, 5)).toBe(5);
  });

  it("uses clamped fallback when input exceeds maximum", () => {
    // input "500" > max 50, fallback 200 > max 50 => returns 50
    expect(normalizeInt("500", 200, 1, 50)).toBe(50);
  });

  // --- Backward compatibility ---

  it("behaves identically for existing call signatures", () => {
    expect(normalizeInt("10", 5, 1)).toBe(10);
    expect(normalizeInt("abc", 5, 1)).toBe(5);
    expect(normalizeInt(undefined, 5, 1)).toBe(5);
    expect(normalizeInt("0", 5, 1)).toBe(5);
    expect(normalizeInt("-3", 5, 1)).toBe(5);
  });

  it("minimum default of 1 still works", () => {
    expect(normalizeInt("0", 10)).toBe(10);
    expect(normalizeInt("5", 10)).toBe(5);
  });
});
