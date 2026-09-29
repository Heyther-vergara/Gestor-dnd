import { describe, expect, it } from "vitest";

import * as rulesEngine from "@/rules-engine";

// Test trivial: comprueba que Vitest corre y que el alias "@/..." resuelve.
describe("tooling smoke test", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @ alias", () => {
    expect(rulesEngine).toBeDefined();
  });
});
