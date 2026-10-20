import { describe, expect, it } from "vitest";

import { feetToMeters, formatModifier } from "@/lib/format";

describe("formatModifier", () => {
  it("adds a plus sign to zero and positives", () => {
    expect(formatModifier(0)).toBe("+0");
    expect(formatModifier(3)).toBe("+3");
  });

  it("uses a typographic minus for negatives", () => {
    expect(formatModifier(-1)).toBe("−1");
  });
});

// SRD 5.2.1 (español): velocidad 9 m (30 pies), visión en la oscuridad 36 m
// (120 pies) y la penalización de armadura de 3 m (10 pies).
describe("feetToMeters", () => {
  it("converts like the Spanish SRD", () => {
    expect(feetToMeters(30)).toBe("9 m");
    expect(feetToMeters(120)).toBe("36 m");
    expect(feetToMeters(10)).toBe("3 m");
  });

  it("uses a decimal comma", () => {
    expect(feetToMeters(25)).toBe("7,5 m");
  });
});
