import { describe, expect, it } from "vitest";

import { arcaneCircle, CIRCLE_SIZE, seededRandom } from "@/lib/arcane-circle";

// Decoración de los márgenes (ADR 0031).

describe("seededRandom", () => {
  it("repeats the same numbers for the same seed", () => {
    const a = seededRandom(3);
    const b = seededRandom(3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays between 0 and 1", () => {
    const random = seededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const n = random();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe("arcaneCircle", () => {
  // Mismo dibujo en el servidor y en el navegador: sin error de hidratación.
  it("is deterministic", () => {
    expect(arcaneCircle(7)).toEqual(arcaneCircle(7));
  });

  it("draws a different set of sigils for another seed", () => {
    expect(arcaneCircle(7).sigils).not.toEqual(arcaneCircle(3).sigils);
  });

  it("has a 7-point star, 12 sigils and every point inside the box", () => {
    const circle = arcaneCircle(3);
    expect(circle.star.match(/[ML]/g)).toHaveLength(7);
    expect(circle.sigils).toHaveLength(12);
    const numbers = [circle.star, circle.ticks, ...circle.sigils]
      .join(" ")
      .match(/-?\d+(\.\d+)?/g)!
      .map(Number);
    expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...numbers)).toBeLessThanOrEqual(CIRCLE_SIZE);
  });

  // Un trazo de un vértice a sí mismo sería un punto invisible.
  it("never draws a sigil stroke of length zero", () => {
    for (const sigil of arcaneCircle(11).sigils) {
      for (const [, from, to] of sigil.matchAll(/M([\d. ]+)L([\d. ]+)/g)) {
        expect(from).not.toBe(to);
      }
    }
  });
});
