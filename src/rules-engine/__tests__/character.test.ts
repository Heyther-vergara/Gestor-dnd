import { describe, expect, it } from "vitest";

import { characterSchema } from "@/rules-engine/schemas";

// Guerrero enano soldado de nivel 3: el personaje de ejemplo de estos tests.
const fighter = {
  id: "char-1",
  name: "Brunhilda",
  edition: "2024",
  activePackageIds: ["srd-2024"],
  classes: [{ classId: "fighter", level: 3 }],
  speciesId: "dwarf",
  backgroundId: "soldier",
  baseAbilityScores: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 },
  choices: [
    {
      kind: "skills",
      contentId: "fighter",
      level: 1,
      skills: ["perception", "survival"],
    },
    {
      kind: "ability-bonus",
      contentId: "soldier",
      level: 1,
      bonuses: { str: 2, con: 1 },
    },
  ],
  inventory: [{ itemId: "chain-mail", equipped: true }],
};

describe("characterSchema", () => {
  it("accepts a level 3 fighter", () => {
    expect(characterSchema.safeParse(fighter).success).toBe(true);
  });

  it("fills defaults for inventory and play state", () => {
    const character = characterSchema.parse(fighter);
    expect(character.inventory[0]).toMatchObject({
      quantity: 1,
      attuned: false,
    });
    expect(character.playState).toEqual({
      damageTaken: 0,
      tempHp: 0,
      hitDiceSpent: 0,
    });
  });

  it("does not store derived values", () => {
    // Las CA, PG máximos, etc. se calculan; si llegan en el JSON, se rechazan.
    const result = characterSchema.safeParse({ ...fighter, ac: 16 });
    expect(result.success).toBe(false);
  });

  it("requires a class", () => {
    const result = characterSchema.safeParse({ ...fighter, classes: [] });
    expect(result.success).toBe(false);
  });

  it("rejects class levels outside 1–20", () => {
    const result = characterSchema.safeParse({
      ...fighter,
      classes: [{ classId: "fighter", level: 21 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects ability scores outside 1–30", () => {
    const result = characterSchema.safeParse({
      ...fighter,
      baseAbilityScores: { ...fighter.baseAbilityScores, str: 31 },
    });
    expect(result.success).toBe(false);
  });

  it("requires all six ability scores", () => {
    const result = characterSchema.safeParse({
      ...fighter,
      baseAbilityScores: { ...fighter.baseAbilityScores, cha: undefined },
    });
    expect(result.success).toBe(false);
  });

  // SRD 5.2.1, "Crear un personaje": +2 a una y +1 a otra distinta, o +1 a las tres.
  describe("background ability bonus", () => {
    const withBonuses = (bonuses: Record<string, number>) => ({
      ...fighter,
      choices: [
        { kind: "ability-bonus", contentId: "soldier", level: 1, bonuses },
      ],
    });

    it("accepts +1 to three abilities", () => {
      const result = characterSchema.safeParse(
        withBonuses({ str: 1, dex: 1, con: 1 }),
      );
      expect(result.success).toBe(true);
    });

    it("rejects +2 and +2", () => {
      const result = characterSchema.safeParse(withBonuses({ str: 2, con: 2 }));
      expect(result.success).toBe(false);
    });

    it("rejects +3 to a single ability", () => {
      const result = characterSchema.safeParse(withBonuses({ str: 3 }));
      expect(result.success).toBe(false);
    });

    it("rejects +1 to only two abilities", () => {
      const result = characterSchema.safeParse(withBonuses({ str: 1, con: 1 }));
      expect(result.success).toBe(false);
    });
  });

  it("rejects an unknown choice kind", () => {
    const result = characterSchema.safeParse({
      ...fighter,
      choices: [{ kind: "wish", contentId: "fighter", level: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative damage taken", () => {
    const result = characterSchema.safeParse({
      ...fighter,
      playState: { damageTaken: -5, tempHp: 0, hitDiceSpent: 0 },
    });
    expect(result.success).toBe(false);
  });
});
