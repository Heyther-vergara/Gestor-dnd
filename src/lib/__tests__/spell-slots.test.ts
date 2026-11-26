import { describe, expect, it } from "vitest";

import { createPlayReducer } from "@/lib/play-reducer";
import { srd2024Index as index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";
import {
  longRest,
  recoverSpellSlot,
  spendSpellSlot,
} from "@/rules-engine/engine/play-state";
import {
  type Character,
  characterSchema,
  type PlayState,
} from "@/rules-engine/schemas";

// Marcar espacios de conjuro gastados (ADR 0028).
// Reglas: SRD 5.2.1, mago, "Espacios de conjuro": la tabla de rasgos del mago
// dice cuántos espacios tienes para lanzar conjuros de nivel 1+, y "recuperas
// todos los espacios gastados cuando finalizas un descanso largo".
// Mago de nivel 3: 4 espacios de nivel 1 y 2 de nivel 2.

const ilse = (
  playState: Partial<PlayState> = {},
  classId = "wizard",
): Character =>
  characterSchema.parse({
    id: "ilse",
    name: "Ilse",
    edition: "2024",
    activePackageIds: ["srd-2024"],
    classes: [{ classId, level: 3 }],
    speciesId: "human",
    backgroundId: "sage",
    baseAbilityScores: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
    playState,
  });

const slotsOf = (character: Character) =>
  calculateSheet(character, index).spellcasting[0];

function expectOk<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error(`Se esperaba ok: ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

describe("spell slots on the sheet", () => {
  it("starts with every slot available", () => {
    expect(slotsOf(ilse())).toMatchObject({
      slots: [4, 2],
      slotsRemaining: [4, 2],
    });
  });

  it("subtracts the spent slots of each level", () => {
    const tired = ilse({ spellSlotsSpent: { wizard: [3, 1] } });
    expect(slotsOf(tired)?.slotsRemaining).toEqual([1, 1]);
  });

  // Un gasto guardado mayor que el máximo (por ejemplo, si cambió la tabla)
  // no deja números negativos.
  it("never goes below zero", () => {
    const odd = ilse({ spellSlotsSpent: { wizard: [9, 0] } });
    expect(slotsOf(odd)?.slotsRemaining).toEqual([0, 2]);
  });

  // Los personajes guardados antes de esta función no tienen el campo.
  it("defaults to nothing spent", () => {
    expect(ilse().playState.spellSlotsSpent).toEqual({});
  });
});

describe("spendSpellSlot", () => {
  it("spends one slot of the chosen level", () => {
    const result = expectOk(spendSpellSlot(ilse(), index, "wizard", 2));
    expect(result.playState.spellSlotsSpent).toEqual({ wizard: [0, 1] });
    const after = { ...ilse(), playState: result.playState };
    expect(slotsOf(after)?.slotsRemaining).toEqual([4, 1]);
  });

  it("adds to the slots already spent", () => {
    const result = expectOk(
      spendSpellSlot(
        ilse({ spellSlotsSpent: { wizard: [2] } }),
        index,
        "wizard",
        1,
      ),
    );
    expect(result.playState.spellSlotsSpent).toEqual({ wizard: [3] });
  });

  it("fails when no slot of that level is left", () => {
    const empty = ilse({ spellSlotsSpent: { wizard: [0, 2] } });
    const result = spendSpellSlot(empty, index, "wizard", 2);
    expect(result).toEqual({
      ok: false,
      reason: "No te quedan espacios de nivel 2",
    });
  });

  // Un mago de nivel 3 no tiene espacios de nivel 3.
  it("fails for a level the class has no slots for", () => {
    expect(spendSpellSlot(ilse(), index, "wizard", 3).ok).toBe(false);
  });

  it("fails for a class that does not cast spells", () => {
    expect(spendSpellSlot(ilse({}, "fighter"), index, "fighter", 1).ok).toBe(
      false,
    );
  });

  it("fails when the character is dead", () => {
    expect(spendSpellSlot(ilse({ dead: true }), index, "wizard", 1).ok).toBe(
      false,
    );
  });
});

// Para corregir un toque equivocado: devuelve un espacio gastado.
describe("recoverSpellSlot", () => {
  it("gives back one spent slot", () => {
    const result = expectOk(
      recoverSpellSlot(
        ilse({ spellSlotsSpent: { wizard: [2, 1] } }),
        index,
        "wizard",
        1,
      ),
    );
    expect(result.playState.spellSlotsSpent).toEqual({ wizard: [1, 1] });
  });

  it("fails when no slot of that level was spent", () => {
    expect(recoverSpellSlot(ilse(), index, "wizard", 1)).toEqual({
      ok: false,
      reason: "No hay espacios de nivel 1 gastados",
    });
  });
});

describe("long rest", () => {
  // SRD 5.2.1, mago, "Espacios de conjuro": recuperas todos los espacios
  // gastados cuando finalizas un descanso largo.
  it("recovers every spent slot", () => {
    const result = expectOk(
      longRest(ilse({ spellSlotsSpent: { wizard: [4, 2] } }), index),
    );
    expect(result.playState.spellSlotsSpent).toEqual({});
  });
});

// El reducer de la hoja traduce el toque en el círculo a la acción del motor.
describe("play reducer", () => {
  const reducer = createPlayReducer(index);

  it("spends a slot and says how many are left", () => {
    const next = reducer(
      { character: ilse(), message: null },
      { type: "spend-spell-slot", classId: "wizard", level: 1 },
    );
    expect(next.message).toEqual({
      tone: "info",
      text: "Gastaste un espacio de nivel 1. Te quedan 3.",
    });
  });

  it("names the spell slots after a long rest", () => {
    const next = reducer(
      { character: ilse({ spellSlotsSpent: { wizard: [1] } }), message: null },
      { type: "long-rest" },
    );
    expect(next.message?.text).toBe(
      "Descanso largo: PG, dados de golpe y espacios de conjuro al máximo.",
    );
  });
});
