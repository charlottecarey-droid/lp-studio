/**
 * Unit tests for the stat-counter-band count-up parser/formatter.
 * Pure functions: parseStatValue splits a display stat into an animatable
 * numeric core + verbatim affixes; formatStatValue reassembles an in-flight
 * frame preserving decimals, grouping, and affixes.
 */
import { describe, it, expect } from "vitest";
import { parseStatValue, formatStatValue } from "./BlockStatCounterBand";

describe("parseStatValue", () => {
  it("parses a bare integer with a plus suffix", () => {
    expect(parseStatValue("350+")).toEqual({
      prefix: "",
      num: 350,
      suffix: "+",
      decimals: 0,
      grouped: false,
    });
  });

  it("parses a percentage with one decimal", () => {
    expect(parseStatValue("99.2%")).toEqual({
      prefix: "",
      num: 99.2,
      suffix: "%",
      decimals: 1,
      grouped: false,
    });
  });

  it("parses currency prefix + magnitude suffix", () => {
    expect(parseStatValue("$4M+")).toEqual({
      prefix: "$",
      num: 4,
      suffix: "M+",
      decimals: 0,
      grouped: false,
    });
  });

  it("parses thousands separators and remembers grouping", () => {
    expect(parseStatValue("12,000+")).toEqual({
      prefix: "",
      num: 12000,
      suffix: "+",
      decimals: 0,
      grouped: true,
    });
  });

  it("keeps only the FIRST numeric run as the core (e.g. 24/7)", () => {
    expect(parseStatValue("24/7")).toEqual({
      prefix: "",
      num: 24,
      suffix: "/7",
      decimals: 0,
      grouped: false,
    });
  });

  it("returns num null for non-numeric values", () => {
    const p = parseStatValue("∞");
    expect(p.num).toBeNull();
    expect(p.suffix).toBe("∞");
  });

  it("handles empty string without throwing", () => {
    expect(parseStatValue("").num).toBeNull();
  });

  it("parses a leading-symbol decimal like ~4.5x", () => {
    expect(parseStatValue("~4.5x")).toEqual({
      prefix: "~",
      num: 4.5,
      suffix: "x",
      decimals: 1,
      grouped: false,
    });
  });
});

describe("formatStatValue", () => {
  it("preserves decimals during the count-up", () => {
    const p = parseStatValue("99.2%");
    expect(formatStatValue(p, 42.1234)).toBe("42.1%");
    expect(formatStatValue(p, 99.2)).toBe("99.2%");
  });

  it("rounds integers and keeps affixes", () => {
    const p = parseStatValue("$4M+");
    expect(formatStatValue(p, 2.6)).toBe("$3M+");
    expect(formatStatValue(p, 4)).toBe("$4M+");
  });

  it("re-applies thousands grouping only when the original had it", () => {
    const grouped = parseStatValue("12,000+");
    expect(formatStatValue(grouped, 6500)).toBe("6,500+");
    const plain = parseStatValue("350+");
    expect(formatStatValue(plain, 350)).toBe("350+");
  });

  it("falls back to the raw value when no numeric core exists", () => {
    const p = parseStatValue("∞");
    expect(formatStatValue(p, 123)).toBe("∞");
  });

  it("final frame reproduces the authored value exactly", () => {
    for (const v of ["99.2%", "$4M+", "350+", "12,000+", "4.9", "24/7"]) {
      const p = parseStatValue(v);
      expect(formatStatValue(p, p.num as number)).toBe(v);
    }
  });
});
