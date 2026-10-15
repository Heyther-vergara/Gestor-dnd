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

  // SRD 5.2.1, monje "Movimiento sin armadura": +3 m si no llevás armadura ni escudo.
  it("accepts an optional condition", () => {
    const result = effectSchema.safeParse({
      target: "speed",
      op: "add",
      value: 10,
      condition: "unarmored-no-shield",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown condition", () => {
    const result = effectSchema.safeParse({
      target: "speed",
      op: "add",
      value: 10,
      condition: "naked",
    });
    expect(result.success).toBe(false);
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

  // Vocabulario cerrado (ADR 0003): un typo ya no pasa la validación.
  it("rejects a target outside the vocabulary (typo)", () => {
    const result = effectSchema.safeParse({
      target: "acc",
      op: "add",
      value: 1,
    });
    expect(result.success).toBe(false);
  });

  it.each([
    "ac",
    "initiative",
    "speed",
    "hp.max",
    "hp.max-per-level",
    "senses.darkvision",
    "spell.attack",
    "spell.dc",
    "ability.str",
    "save.wis",
    "skill.sleight-of-hand",
  ])("accepts the numeric target %s", (target) => {
    const result = effectSchema.safeParse({ target, op: "add", value: 1 });
    expect(result.success).toBe(true);
  });

  it.each([
    "proficiency.skill.stealth",
    "proficiency.save.con",
    "proficiency.armor.shield",
    "proficiency.weapon.martial",
  ])("accepts the grant target %s", (target) => {
    const result = effectSchema.safeParse({ target, op: "grant" });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown skill or ability inside a target", () => {
    expect(
      effectSchema.safeParse({ target: "skill.cooking", op: "add", value: 1 })
        .success,
    ).toBe(false);
    expect(
      effectSchema.safeParse({ target: "save.luck", op: "add", value: 1 })
        .success,
    ).toBe(false);
  });

  it("rejects granting a numeric target", () => {
    const result = effectSchema.safeParse({ target: "ac", op: "grant" });
    expect(result.success).toBe(false);
  });

  it("rejects adding a number to a proficiency", () => {
    const result = effectSchema.safeParse({
      target: "proficiency.skill.stealth",
      op: "add",
      value: 1,
    });
    expect(result.success).toBe(false);
  });

  // SRD 5.2.1, bárbaro "Defensa sin armadura": 10 + Des + Con, también con escudo.
  it("accepts Unarmored Defense as a conditional base AC", () => {
    const result = effectSchema.safeParse({
      target: "ac",
      op: "base",
      value: 10,
      abilities: ["dex", "con"],
      condition: "unarmored",
    });
    expect(result.success).toBe(true);
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
          strengthRequirement: 13,
          stealthDisadvantage: true,
        },
      },
      // SRD 5.2.1 "Armaduras": la CA base con cota de malla es 16.
      effects: [{ target: "ac", op: "base", value: 16 }],
    });
    expect(result.success).toBe(true);
  });

  // ADR 0003: la CA de una armadura vive solo en sus efectos.
  it("rejects AC stored in the armor data", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "chain-mail",
      type: "item",
      name: "Chain Mail",
      data: {
        category: "armor",
        armor: {
          armorCategory: "heavy",
          baseAc: 16,
          stealthDisadvantage: true,
        },
      },
      effects: [{ target: "ac", op: "base", value: 16 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an armor without a base AC effect", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "leather-armor",
      type: "item",
      name: "Leather Armor",
      data: {
        category: "armor",
        armor: { armorCategory: "light", stealthDisadvantage: false },
      },
    });
    expect(result.success).toBe(false);
  });

  // SRD 5.2.1 "Armaduras": armadura media 14 + Des (máx. 2).
  it("accepts medium armor with a capped Dex bonus", () => {
    const result = contentSchema.safeParse({
      ...base,
      id: "scale-mail",
      type: "item",
      name: "Scale Mail",
      data: {
        category: "armor",
        armor: { armorCategory: "medium", stealthDisadvantage: true },
      },
      effects: [
        {
          target: "ac",
          op: "base",
          value: 14,
          abilities: ["dex"],
          maxAbilityBonus: 2,
        },
      ],
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
