import { describe, expect, it } from "vitest";

import { canAddSpell, classSpellOptions, toggleSpell } from "@/lib/spells";
import { srd2024Index as index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";
import { type Character, characterSchema } from "@/rules-engine/schemas";

// Preparar y cambiar conjuros desde la hoja (ADR 0021).
// Reglas: SRD 5.2.1, mago, "Conjuros preparados de nivel 1+" (cuatro en el
// nivel 1, del libro y de niveles con espacios), "Cambiar tus conjuros
// preparados" y "Trucos" (se puede cambiar uno al terminar un descanso largo).

const BOOK = [
  "detect-magic",
  "feather-fall",
  "mage-armor",
  "magic-missile",
  "sleep",
  "thunderwave",
];

const ilse = (prepared: string[] = [], level = 1): Character =>
  characterSchema.parse({
    id: "ilse",
    name: "Ilse",
    edition: "2024",
    activePackageIds: ["srd-2024"],
    classes: [
      {
        classId: "wizard",
        level,
        cantripIds: ["light", "mage-hand", "ray-of-frost"],
        spellbookIds: BOOK,
        preparedSpellIds: prepared,
      },
    ],
    speciesId: "human",
    backgroundId: "sage",
    baseAbilityScores: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
  });

const prepared = (character: Character) =>
  character.classes[0]?.preparedSpellIds;

describe("classSpellOptions", () => {
  it("prepares only from the spellbook", () => {
    const options = classSpellOptions(ilse(), "wizard", index);
    // Por nombre en español: Armadura de mago, Caída de pluma, Detectar
    // magia, Dormir, Ola atronadora, Proyectil mágico.
    expect(options?.prepared.map((s) => s.id)).toEqual([
      "mage-armor",
      "feather-fall",
      "detect-magic",
      "sleep",
      "thunderwave",
      "magic-missile",
    ]);
  });

  it("is null for a class that does not cast spells", () => {
    const fighter = characterSchema.parse({
      ...ilse(),
      classes: [{ classId: "fighter", level: 1 }],
    });
    expect(classSpellOptions(fighter, "fighter", index)).toBeNull();
  });
});

describe("toggleSpell: prepared spells", () => {
  it("prepares a spell from the book", () => {
    const next = toggleSpell(
      ilse(),
      "wizard",
      "preparedSpellIds",
      "sleep",
      index,
    );
    expect(prepared(next)).toEqual(["sleep"]);
  });

  it("unprepares a prepared spell", () => {
    const next = toggleSpell(
      ilse(["sleep", "mage-armor"]),
      "wizard",
      "preparedSpellIds",
      "sleep",
      index,
    );
    expect(prepared(next)).toEqual(["mage-armor"]);
  });

  // Cuatro preparados en el nivel 1: el quinto no entra.
  it("does not prepare more than the level allows", () => {
    const full = ilse(BOOK.slice(0, 4));
    expect(
      canAddSpell(full, "wizard", "preparedSpellIds", "thunderwave", index),
    ).toBe(false);
    expect(
      toggleSpell(full, "wizard", "preparedSpellIds", "thunderwave", index),
    ).toBe(full);
  });

  it("does not prepare a spell that is not in the book", () => {
    const character = ilse();
    expect(
      toggleSpell(character, "wizard", "preparedSpellIds", "shield", index),
    ).toBe(character);
  });
});

describe("toggleSpell: cantrips and spellbook", () => {
  // "Trucos": al terminar un descanso largo se puede cambiar uno por otro.
  it("swaps a cantrip by removing one and adding another", () => {
    const removed = toggleSpell(ilse(), "wizard", "cantripIds", "light", index);
    const swapped = toggleSpell(
      removed,
      "wizard",
      "cantripIds",
      "fire-bolt",
      index,
    );
    expect(swapped.classes[0]?.cantripIds).toEqual([
      "mage-hand",
      "ray-of-frost",
      "fire-bolt",
    ]);
    expect(calculateSheet(swapped, index).issues).toEqual([]);
  });

  it("does not add a fourth cantrip at level 1", () => {
    const character = ilse();
    expect(
      toggleSpell(character, "wizard", "cantripIds", "fire-bolt", index),
    ).toBe(character);
  });

  it("removing a spell from the book also unprepares it", () => {
    const next = toggleSpell(
      ilse(["sleep"]),
      "wizard",
      "spellbookIds",
      "sleep",
      index,
    );
    expect(next.classes[0]?.spellbookIds).not.toContain("sleep");
    expect(prepared(next)).toEqual([]);
  });

  // En el nivel 2 el libro admite 8: hay lugar para dos más, de nivel 1.
  it("adds to the book only spells of a level with slots", () => {
    const character = ilse([], 2);
    expect(
      canAddSpell(character, "wizard", "spellbookIds", "shield", index),
    ).toBe(true);
    expect(
      canAddSpell(character, "wizard", "spellbookIds", "misty-step", index),
    ).toBe(false);
  });
});
