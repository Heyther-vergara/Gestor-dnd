import { describe, expect, it } from "vitest";

import { calculateSheet, createContentIndex } from "@/rules-engine/engine";
import {
  type Character,
  type CharacterInput,
  characterSchema,
  type Content,
  contentSchema,
} from "@/rules-engine/schemas";

// Lo que cambia al subir de nivel (ADR 0016): subclase, mejora de
// característica, rasgos ganados y espacios de conjuro. Contenido de prueba
// mínimo; el contenido SRD real se prueba en src/content/__tests__.

const content = (raw: unknown): Content => contentSchema.parse(raw);

const classData = {
  primaryAbilities: ["int"],
  savingThrows: ["int", "wis"],
  skillChoices: { count: 2, options: ["arcana", "history"] },
  armorProficiencies: [],
  weaponProficiencies: [],
};

// Como la tabla "Rasgos de mago" del SRD 5.2.1: subclase en el nivel 3,
// "Mejora de característica" en el 4 y espacios de conjuro 2 / 3 / 4-2 /
// 4-3 / 4-3-2 de los niveles 1 a 5.
const wizard = content({
  id: "wizard",
  packageId: "srd-2024",
  type: "class",
  name: "Mago",
  description: "",
  data: {
    ...classData,
    hitDie: 6,
    spellcasting: {
      ability: "int",
      preparation: "prepared",
      slotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2]],
    },
    features: [
      { level: 1, name: "Lanzamiento de conjuros", description: "" },
      { level: 2, name: "Académico", description: "" },
      {
        level: 3,
        name: "Subclase de mago",
        description: "",
        grants: "subclass",
      },
      {
        level: 4,
        name: "Mejora de característica",
        description: "",
        grants: "ability-score-improvement",
      },
      { level: 5, name: "Memorizar conjuro", description: "" },
    ],
  },
});

const fighter = content({
  id: "fighter",
  packageId: "srd-2024",
  type: "class",
  name: "Guerrero",
  description: "",
  data: { ...classData, hitDie: 10, features: [] },
});

// "Subclase de mago: Evocador". El efecto de CD es inventado: sirve para ver
// que los efectos de los rasgos de subclase se aplican.
const evoker = content({
  id: "evoker",
  packageId: "srd-2024",
  type: "subclass",
  name: "Evocador",
  description: "",
  data: {
    classId: "wizard",
    features: [
      {
        level: 3,
        name: "Experto en evocación",
        description: "",
        effects: [{ target: "spell.dc", op: "add", value: 1 }],
      },
      { level: 6, name: "Esculpir conjuros", description: "" },
    ],
  },
});

const champion = content({
  id: "champion",
  packageId: "srd-2024",
  type: "subclass",
  name: "Campeón",
  description: "",
  data: { classId: "fighter", features: [] },
});

const human = content({
  id: "human",
  packageId: "srd-2024",
  type: "species",
  name: "Humano",
  description: "",
  data: { size: ["medium"], speed: 30, traits: [] },
});

const sage = content({
  id: "sage",
  packageId: "srd-2024",
  type: "background",
  name: "Erudito",
  description: "",
  data: {
    abilityOptions: ["con", "int", "wis"],
    featId: "magic-initiate",
    skillProficiencies: ["arcana", "history"],
    toolProficiency: "Calligrapher's Supplies",
  },
});

const magicInitiate = content({
  id: "magic-initiate",
  packageId: "srd-2024",
  type: "feat",
  name: "Iniciado en la magia",
  description: "",
  data: { category: "origin" },
});

const index = createContentIndex([
  wizard,
  fighter,
  evoker,
  champion,
  human,
  sage,
  magicInitiate,
]);

const makeWizard = (overrides: Partial<CharacterInput> = {}): Character =>
  characterSchema.parse({
    id: "w",
    name: "Ilse",
    edition: "2024",
    activePackageIds: ["srd-2024"],
    classes: [{ classId: "wizard", level: 1 }],
    speciesId: "human",
    backgroundId: "sage",
    baseAbilityScores: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
    ...overrides,
  });

describe("calculateSheet: spell slots", () => {
  // SRD 5.2.1, tabla "Rasgos de mago", "Espacios de conjuro por cada nivel de
  // conjuro": nivel 1 → 2 de nivel 1; nivel 3 → 4 y 2; nivel 5 → 4, 3 y 2.
  it.each([
    [1, [2]],
    [2, [3]],
    [3, [4, 2]],
    [4, [4, 3]],
    [5, [4, 3, 2]],
  ])("a level %i wizard has slots %j", (level, slots) => {
    const sheet = calculateSheet(
      makeWizard({ classes: [{ classId: "wizard", level }] }),
      index,
    );
    expect(sheet.spellcasting[0]?.slots).toEqual(slots);
  });

  it("has no slots past the end of the table", () => {
    const sheet = calculateSheet(
      makeWizard({ classes: [{ classId: "wizard", level: 6 }] }),
      index,
    );
    expect(sheet.spellcasting[0]?.slots).toEqual([]);
  });
});

describe("calculateSheet: class features", () => {
  it("lists the features reached, in level order", () => {
    const sheet = calculateSheet(
      makeWizard({ classes: [{ classId: "wizard", level: 2 }] }),
      index,
    );
    expect(sheet.features.map((f) => [f.level, f.name, f.sourceId])).toEqual([
      [1, "Lanzamiento de conjuros", "wizard"],
      [2, "Académico", "wizard"],
    ]);
  });

  // SRD 5.2.1, "Subclase de mago": "obtienes todos los rasgos de tu subclase
  // que sean de tu nivel de mago e inferiores".
  it("adds the subclass features up to the class level", () => {
    const sheet = calculateSheet(
      makeWizard({
        classes: [{ classId: "wizard", level: 3, subclassId: "evoker" }],
      }),
      index,
    );
    expect(sheet.issues).toEqual([]);
    expect(
      sheet.features.filter((f) => f.sourceId === "evoker").map((f) => f.name),
    ).toEqual(["Experto en evocación"]);
  });

  it("applies the effects of subclass features", () => {
    const base = { str: 8, dex: 12, con: 13, int: 16, wis: 14, cha: 10 };
    const withSubclass = calculateSheet(
      makeWizard({
        baseAbilityScores: base,
        classes: [{ classId: "wizard", level: 3, subclassId: "evoker" }],
      }),
      index,
    );
    // 8 + Int (+3) + competencia (+2) + 1 del rasgo de prueba.
    expect(withSubclass.spellcasting[0]?.saveDc).toBe(14);
  });

  it("reports a subclass of another class", () => {
    const sheet = calculateSheet(
      makeWizard({
        classes: [{ classId: "wizard", level: 3, subclassId: "champion" }],
      }),
      index,
    );
    expect(sheet.issues).toEqual([
      'La subclase "champion" no es de la clase "wizard"',
    ]);
    expect(sheet.features.some((f) => f.sourceId === "champion")).toBe(false);
  });

  // La subclase se elige con el rasgo "Subclase de mago", de nivel 3.
  it("reports a subclass chosen before the level that grants it", () => {
    const sheet = calculateSheet(
      makeWizard({
        classes: [{ classId: "wizard", level: 2, subclassId: "evoker" }],
      }),
      index,
    );
    expect(sheet.issues).toEqual([
      'La clase "wizard" da la subclase en el nivel 3, no en el 2',
    ]);
  });
});

describe("calculateSheet: ability score improvement", () => {
  const level4 = (choices: CharacterInput["choices"]) =>
    makeWizard({ classes: [{ classId: "wizard", level: 4 }], choices });

  // SRD 5.2.1, dote "Mejora de característica": "Aumenta en 2 una puntuación
  // de característica que elijas o aumenta dos en 1 cada una".
  it("adds +2 to one ability", () => {
    const sheet = calculateSheet(
      level4([
        {
          kind: "ability-score-improvement",
          contentId: "wizard",
          level: 4,
          bonuses: { int: 2 },
        },
      ]),
      index,
    );
    expect(sheet.issues).toEqual([]);
    expect(sheet.abilities.int.score).toBe(17);
  });

  it("adds +1 to two abilities", () => {
    const sheet = calculateSheet(
      level4([
        {
          kind: "ability-score-improvement",
          contentId: "wizard",
          level: 4,
          bonuses: { int: 1, con: 1 },
        },
      ]),
      index,
    );
    expect(sheet.abilities.int.score).toBe(16);
    expect(sheet.abilities.con.score).toBe(14);
  });

  // "Esta dote no puede aumentar una puntuación de característica por encima
  // de 20". Se suma después del aumento del trasfondo: 17 + 2 + 2 → 20.
  it("does not raise a score above 20", () => {
    const sheet = calculateSheet(
      makeWizard({
        classes: [{ classId: "wizard", level: 4 }],
        baseAbilityScores: {
          str: 8,
          dex: 12,
          con: 13,
          int: 17,
          wis: 14,
          cha: 10,
        },
        choices: [
          {
            kind: "ability-bonus",
            contentId: "sage",
            level: 1,
            bonuses: { int: 2, wis: 1 },
          },
          {
            kind: "ability-score-improvement",
            contentId: "wizard",
            level: 4,
            bonuses: { int: 2 },
          },
        ],
      }),
      index,
    );
    expect(sheet.abilities.int.score).toBe(20);
  });

  it("ignores an improvement the class has not granted yet", () => {
    const sheet = calculateSheet(
      makeWizard({
        classes: [{ classId: "wizard", level: 3 }],
        choices: [
          {
            kind: "ability-score-improvement",
            contentId: "wizard",
            level: 4,
            bonuses: { int: 2 },
          },
        ],
      }),
      index,
    );
    expect(sheet.abilities.int.score).toBe(15);
    expect(sheet.issues).toEqual([
      'La clase "wizard" no da una mejora de característica en el nivel 4',
    ]);
  });

  it("ignores a second improvement for the same feature", () => {
    const choice = {
      kind: "ability-score-improvement" as const,
      contentId: "wizard",
      level: 4,
      bonuses: { int: 2 },
    };
    const sheet = calculateSheet(level4([choice, choice]), index);
    expect(sheet.abilities.int.score).toBe(17);
    expect(sheet.issues).toEqual([
      'Hay más de una mejora de característica de "wizard" en el nivel 4',
    ]);
  });

  it("rejects a choice that is not +2 or +1/+1", () => {
    expect(() =>
      level4([
        {
          kind: "ability-score-improvement",
          contentId: "wizard",
          level: 4,
          bonuses: { int: 1 },
        },
      ]),
    ).toThrow();
  });
});
