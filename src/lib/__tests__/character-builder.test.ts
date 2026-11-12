import { describe, expect, it } from "vitest";

import {
  buildCharacter,
  builderOptions,
  type CharacterDraft,
  draftErrors,
  emptyDraft,
  isStandardArrayAssignment,
  overlappingSkills,
  suggestedAbilityScores,
} from "@/lib/character-builder";
import { srd2024Index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";

// Guerrera humana soldado, con el conjunto estándar sugerido para guerrero.
function fighterDraft(): CharacterDraft {
  return {
    ...emptyDraft(),
    name: "  Aldara  ",
    speciesId: "human",
    size: "medium",
    classId: "fighter",
    classSkills: ["perception", "survival"],
    backgroundId: "soldier",
    abilityBonus: { mode: "two-one", plusTwo: "str", plusOne: "con" },
    baseAbilityScores: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 },
  };
}

describe("builderOptions", () => {
  it("lists the species, classes and backgrounds of the package", () => {
    const options = builderOptions(srd2024Index);
    expect(options.species.map((s) => s.id)).toEqual([
      "dwarf",
      "human",
      "halfling",
    ]);
    expect(options.classes.map((c) => c.id)).toEqual(["fighter", "wizard"]);
    expect(options.backgrounds.map((b) => b.id)).toEqual([
      "acolyte",
      "sage",
      "soldier",
    ]);
  });
});

describe("standard array", () => {
  // SRD 5.2.1, "Conjunto estándar": 15, 14, 13, 12, 10 y 8.
  it("accepts each number exactly once, in any order", () => {
    expect(
      isStandardArrayAssignment({
        str: 8,
        dex: 10,
        con: 12,
        int: 13,
        wis: 14,
        cha: 15,
      }),
    ).toBe(true);
  });

  it("rejects repeated numbers and blanks", () => {
    expect(
      isStandardArrayAssignment({
        str: 15,
        dex: 15,
        con: 13,
        int: 12,
        wis: 10,
        cha: 8,
      }),
    ).toBe(false);
    expect(isStandardArrayAssignment(emptyDraft().baseAbilityScores)).toBe(
      false,
    );
  });

  // SRD 5.2.1, tabla "Conjunto estándar por clase".
  it("suggests the class table and is itself a valid assignment", () => {
    expect(suggestedAbilityScores("fighter")).toEqual({
      str: 15,
      dex: 14,
      con: 13,
      int: 8,
      wis: 10,
      cha: 12,
    });
    expect(suggestedAbilityScores("wizard")).toEqual({
      str: 8,
      dex: 12,
      con: 13,
      int: 15,
      wis: 14,
      cha: 10,
    });
    expect(suggestedAbilityScores("bard")).toBeNull();
    for (const id of ["fighter", "wizard"]) {
      const scores = suggestedAbilityScores(id);
      expect(scores && isStandardArrayAssignment(scores)).toBe(true);
    }
  });
});

describe("draftErrors", () => {
  it("has an error in every step for an empty draft", () => {
    expect(Object.keys(draftErrors(emptyDraft(), srd2024Index))).toEqual([
      "name",
      "species",
      "class",
      "background",
      "abilities",
    ]);
  });

  it("has no errors for a complete draft", () => {
    expect(draftErrors(fighterDraft(), srd2024Index)).toEqual({});
  });

  it("requires a name with text", () => {
    const draft = { ...fighterDraft(), name: "   " };
    expect(draftErrors(draft, srd2024Index).name).toBeDefined();
  });

  // SRD 5.2.1, "Humano": tamaño mediano o pequeño, a elección.
  it("asks for a size only when the species offers more than one", () => {
    const human = { ...fighterDraft(), size: null };
    expect(draftErrors(human, srd2024Index).species).toBe("Elegí un tamaño.");

    const dwarf = { ...fighterDraft(), speciesId: "dwarf", size: null };
    expect(draftErrors(dwarf, srd2024Index).species).toBeUndefined();
  });

  // SRD 5.2.1, "Guerrero": competencias con habilidades, elige 2.
  it("requires exactly the number of class skills, from the class list", () => {
    const one = { ...fighterDraft(), classSkills: ["perception" as const] };
    expect(draftErrors(one, srd2024Index).class).toBe("Elegí 2 habilidades.");

    const arcana = {
      ...fighterDraft(),
      classSkills: ["perception" as const, "arcana" as const],
    };
    expect(draftErrors(arcana, srd2024Index).class).toBeDefined();

    const repeated = {
      ...fighterDraft(),
      classSkills: ["perception" as const, "perception" as const],
    };
    expect(draftErrors(repeated, srd2024Index).class).toBeDefined();
  });

  // SRD 5.2.1, "Ajusta las puntuaciones de característica": +2 a una y +1 a
  // otra distinta, de las tres del trasfondo.
  it("checks the background increases", () => {
    const same = {
      ...fighterDraft(),
      abilityBonus: {
        mode: "two-one" as const,
        plusTwo: "str" as const,
        plusOne: "str" as const,
      },
    };
    expect(draftErrors(same, srd2024Index).background).toBeDefined();

    // Soldado ofrece Fue, Des y Con: no Int.
    const notOffered = {
      ...fighterDraft(),
      abilityBonus: {
        mode: "two-one" as const,
        plusTwo: "int" as const,
        plusOne: "str" as const,
      },
    };
    expect(draftErrors(notOffered, srd2024Index).background).toBeDefined();

    const threeOnes = {
      ...fighterDraft(),
      abilityBonus: { mode: "one-one-one" as const },
    };
    expect(draftErrors(threeOnes, srd2024Index).background).toBeUndefined();
  });
});

describe("overlappingSkills", () => {
  // Soldado ya da Atletismo e Intimidación.
  it("reports class skills the background already grants", () => {
    const draft = {
      ...fighterDraft(),
      classSkills: ["athletics" as const, "perception" as const],
    };
    expect(overlappingSkills(draft, srd2024Index)).toEqual(["athletics"]);
  });
});

describe("buildCharacter", () => {
  it("does not build an incomplete draft", () => {
    const result = buildCharacter(emptyDraft(), srd2024Index, "new-1");
    expect(result.ok).toBe(false);
  });

  it("stores only choices, with a level 1 class and fresh play state", () => {
    const result = buildCharacter(fighterDraft(), srd2024Index, "new-1");
    if (!result.ok) throw new Error("expected a character");
    const { character } = result;

    expect(character).toMatchObject({
      id: "new-1",
      name: "Aldara",
      edition: "2024",
      activePackageIds: ["srd-2024"],
      classes: [{ classId: "fighter", level: 1 }],
      speciesId: "human",
      backgroundId: "soldier",
      inventory: [],
    });
    expect(character.choices).toEqual([
      {
        kind: "ability-bonus",
        contentId: "soldier",
        level: 1,
        bonuses: { str: 2, con: 1 },
      },
      {
        kind: "skills",
        contentId: "fighter",
        level: 1,
        skills: ["perception", "survival"],
      },
      { kind: "size", contentId: "human", level: 1, size: "medium" },
    ]);
    expect(character.playState.damageTaken).toBe(0);
  });

  // Guerrero nivel 1, Fue 15+2 = 17, Con 13+1 = 14 (+2).
  // SRD 5.2.1, "Guerrero": PG en el nivel 1 = 10 + modificador de Con = 12.
  // Sin armadura: CA = 10 + Des (+2) = 12. Competencia +2 en el nivel 1.
  it("gives a sheet the engine calculates without issues", () => {
    const result = buildCharacter(fighterDraft(), srd2024Index, "new-1");
    if (!result.ok) throw new Error("expected a character");
    const sheet = calculateSheet(result.character, srd2024Index);

    expect(sheet.issues).toEqual([]);
    expect(sheet.abilities.str.score).toBe(17);
    expect(sheet.abilities.con.score).toBe(14);
    expect(sheet.hitPoints.max).toBe(12);
    expect(sheet.ac).toBe(12);
    expect(sheet.proficiencyBonus).toBe(2);
    expect(sheet.skills.perception.proficiency).toBe("proficient");
    // Del trasfondo Soldado.
    expect(sheet.skills.athletics.proficiency).toBe("proficient");
  });

  // Mago enano sabio con +1 a las tres (Con, Int, Sab).
  // SRD 5.2.1, "Mago": PG en el nivel 1 = 6 + Con. Con 13+1 = 14 (+2).
  // "Enano", "Aguante enano": +1 PG por nivel. Total 9.
  it("builds a wizard with +1 to all three background abilities", () => {
    const draft: CharacterDraft = {
      ...emptyDraft(),
      name: "Borin",
      speciesId: "dwarf",
      classId: "wizard",
      classSkills: ["arcana", "investigation"],
      backgroundId: "sage",
      abilityBonus: { mode: "one-one-one" },
      baseAbilityScores: suggestedAbilityScores("wizard") ?? {
        ...emptyDraft().baseAbilityScores,
      },
    };
    const result = buildCharacter(draft, srd2024Index, "new-2");
    if (!result.ok) throw new Error("expected a character");

    // El enano tiene un solo tamaño: no se guarda elección de tamaño.
    expect(result.character.choices.map((c) => c.kind)).toEqual([
      "ability-bonus",
      "skills",
    ]);

    const sheet = calculateSheet(result.character, srd2024Index);
    expect(sheet.issues).toEqual([]);
    expect(sheet.abilities.int.score).toBe(16);
    expect(sheet.abilities.wis.score).toBe(15);
    expect(sheet.hitPoints.max).toBe(9);
  });
});
