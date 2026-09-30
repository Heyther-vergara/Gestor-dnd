import { describe, expect, it } from "vitest";

import {
  contentSchema,
  effectSchema,
  packageSchema,
} from "@/rules-engine/schemas";

describe("effectSchema", () => {
  it("accepts a numeric bonus (Escudo: +2 CA)", () => {
    const result = effectSchema.safeParse({
      target: "ac",
      op: "add",
      value: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a base AC formula (cota de mallas: CA base 16)", () => {
    const result = effectSchema.safeParse({
      target: "ac",
      op: "base",
      value: 16,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a proficiency grant without value", () => {
    const result = effectSchema.safeParse({
      target: "proficiency.skill.stealth",
      op: "grant",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an optional condition", () => {
    const result = effectSchema.safeParse({
      target: "speed",
      op: "add",
      value: 10,
      condition: "unarmored",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a numeric op without a number value", () => {
    const result = effectSchema.safeParse({ target: "ac", op: "add" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown op", () => {
    const result = effectSchema.safeParse({
      target: "ac",
      op: "divide",
      value: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed target", () => {
    const result = effectSchema.safeParse({
      target: "Armor Class",
      op: "add",
      value: 1,
    });
    expect(result.success).toBe(false);
  });

  // SRD 5.2.1, "Armaduras" (pág. 99) y conjuro "Armadura de mago".
  it("accepts ability modifiers in a value (Armadura de mago: 13 + Des)", () => {
    const result = effectSchema.safeParse({
      target: "ac",
      op: "base",
      value: 13,
      abilities: ["dex"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a cap on the ability bonus (armadura media: 14 + Des, máx. 2)", () => {
    const result = effectSchema.safeParse({
      target: "ac",
      op: "base",
      value: 14,
      abilities: ["dex"],
      maxAbilityBonus: 2,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a cap without abilities to cap", () => {
    const result = effectSchema.safeParse({
      target: "ac",
      op: "base",
      value: 14,
      maxAbilityBonus: 2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown ability", () => {
    const result = effectSchema.safeParse({
      target: "ac",
      op: "base",
      value: 10,
      abilities: ["luck"],
    });
    expect(result.success).toBe(false);
  });
});

describe("packageSchema", () => {
  const srd2024 = {
    id: "srd-2024",
    name: "SRD 5.2.1",
    edition: "2024",
    author: "Wizards of the Coast",
    version: "5.2.1",
    visibility: "public",
    source: "srd",
  };

  it("accepts the SRD 2024 package", () => {
    expect(packageSchema.safeParse(srd2024).success).toBe(true);
  });

  it("rejects an unknown edition", () => {
    const result = packageSchema.safeParse({ ...srd2024, edition: "2030" });
    expect(result.success).toBe(false);
  });

  it("rejects ids that are not kebab-case", () => {
    const result = packageSchema.safeParse({ ...srd2024, id: "SRD 2024" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys (typos in hand-written JSON)", () => {
    const result = packageSchema.safeParse({ ...srd2024, editon: "2024" });
    expect(result.success).toBe(false);
  });
});

describe("contentSchema", () => {
  const base = {
    packageId: "srd-2024",
    description: "Texto de ejemplo.",
  };

  it("accepts a class", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "fighter",
      type: "class",
      name: "Fighter",
      data: {
        hitDie: 10,
        primaryAbilities: ["str", "dex"],
        savingThrows: ["str", "con"],
        skillChoices: {
          count: 2,
          options: ["acrobatics", "athletics", "history", "perception"],
        },
        armorProficiencies: ["light", "medium", "heavy", "shield"],
        weaponProficiencies: ["simple", "martial"],
        features: [
          {
            level: 1,
            name: "Second Wind",
            description: "Recupera PG como acción adicional.",
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("defaults effects to an empty list", () => {
    const result = contentSchema.parse({
      ...base,
      id: "alert",
      type: "feat",
      name: "Alert",
      data: { category: "origin" },
    });
    expect(result.effects).toEqual([]);
  });

  it("accepts a species with trait effects", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "dwarf",
      type: "species",
      name: "Dwarf",
      data: {
        size: ["medium"],
        speed: 30,
        traits: [
          {
            name: "Darkvision",
            description: "Ves en la oscuridad hasta 120 pies.",
            effects: [{ target: "senses.darkvision", op: "max", value: 120 }],
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a 2024 background", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "soldier",
      type: "background",
      name: "Soldier",
      data: {
        abilityOptions: ["str", "dex", "con"],
        featId: "savage-attacker",
        skillProficiencies: ["athletics", "intimidation"],
        toolProficiency: "Gaming set",
        equipment: "Spear, shortbow, 20 arrows...",
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a spell", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "magic-missile",
      type: "spell",
      name: "Magic Missile",
      data: {
        level: 1,
        school: "evocation",
        castingTime: "Action",
        range: "120 feet",
        components: { verbal: true, somatic: true },
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        classIds: ["sorcerer", "wizard"],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts armor as an item", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "chain-mail",
      type: "item",
      name: "Chain Mail",
      data: {
        category: "armor",
        weight: 55,
        cost: { amount: 75, unit: "gp" },
        armor: {
          armorCategory: "heavy",
          baseAc: 16,
          dexCap: 0,
          strengthRequirement: 13,
          stealthDisadvantage: true,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a spell level above 9", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "wish-plus",
      type: "spell",
      name: "Wish+",
      data: {
        level: 10,
        school: "conjuration",
        castingTime: "Action",
        range: "Self",
        components: { verbal: true, somatic: false },
        duration: "Instantaneous",
        concentration: false,
        ritual: false,
        classIds: ["wizard"],
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects data that does not match its type", () => {
    // Datos de conjuro con type "class": la unión discriminada lo detecta.
    const result = contentSchema.safeParse({
      ...base,
      id: "fighter",
      type: "class",
      name: "Fighter",
      data: { level: 1, school: "evocation" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown content type", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "beholder",
      type: "monster",
      name: "Beholder",
      data: {},
    });
    expect(result.success).toBe(false);
  });
});
