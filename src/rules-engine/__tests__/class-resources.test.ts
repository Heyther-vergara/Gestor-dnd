import { describe, expect, it } from "vitest";

import { calculateSheet, createContentIndex } from "@/rules-engine/engine";
import { longRest, spendResource } from "@/rules-engine/engine/play-state";
import {
  type Character,
  type CharacterInput,
  characterSchema,
  type Content,
  contentSchema,
} from "@/rules-engine/schemas";

// Recursos de clase, CD de clase y herramientas (ADR 0020). Son para clases
// homebrew: el SRD 5.2.1 no tiene ninguna clase así en el paquete. La clase
// de prueba es inventada ("Inventor"), con números elegidos para el test.

const content = (raw: unknown): Content => contentSchema.parse(raw);

const tinkerer = content({
  id: "tinkerer",
  packageId: "homebrew-test",
  type: "class",
  name: "Inventor",
  description: "",
  data: {
    hitDie: 8,
    primaryAbilities: ["int"],
    savingThrows: ["int", "con"],
    skillChoices: { count: 2, options: ["arcana", "investigation"] },
    armorProficiencies: ["light"],
    weaponProficiencies: ["simple"],
    toolProficiencies: ["Herramientas de hojalatero"],
    // 3 en el nivel 1, 4 en el 2, 6 en el 3; la tabla termina ahí.
    resources: [
      {
        id: "gear-points",
        name: "Puntos de engranaje",
        maxByLevel: [3, 4, 6],
        perUseLimitByLevel: [2, 2, 3],
        recharge: "long-rest",
      },
    ],
    saveDcs: [{ name: "CD de Inventos", ability: "int" }],
    features: [],
  },
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

const index = createContentIndex([tinkerer, human, sage, magicInitiate]);

const makeTinkerer = (
  level = 1,
  overrides: Partial<CharacterInput> = {},
): Character =>
  characterSchema.parse({
    id: "t",
    name: "Ada",
    edition: "2024",
    activePackageIds: ["srd-2024", "homebrew-test"],
    classes: [{ classId: "tinkerer", level }],
    speciesId: "human",
    backgroundId: "sage",
    // Int 16 → +3.
    baseAbilityScores: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 },
    ...overrides,
  });

describe("calculateSheet: class resources", () => {
  it.each([
    [1, 3, 2],
    [2, 4, 2],
    [3, 6, 3],
    // Más allá de la tabla se usa el último valor.
    [5, 6, 3],
  ])("a level %i tinkerer has %i points, %i per use", (level, max, limit) => {
    const [resource] = calculateSheet(makeTinkerer(level), index).resources;
    expect(resource).toEqual({
      id: "gear-points",
      classId: "tinkerer",
      name: "Puntos de engranaje",
      max,
      remaining: max,
      perUseLimit: limit,
    });
  });

  it("subtracts the points spent, down to 0", () => {
    const spent = (n: number) =>
      calculateSheet(
        makeTinkerer(2, {
          playState: { resourcesSpent: { "gear-points": n } },
        }),
        index,
      ).resources[0]?.remaining;
    expect(spent(1)).toBe(3);
    expect(spent(9)).toBe(0);
  });

  it("characters saved before resources existed start with none spent", () => {
    const old = makeTinkerer(1);
    expect(old.playState.resourcesSpent).toEqual({});
  });
});

describe("calculateSheet: class save DC", () => {
  // Como la CD de conjuros del SRD 5.2.1 ("Rellena los números"):
  // 8 + competencia + modificador. Nivel 1: 8 + 2 + 3 = 13.
  it("is 8 + proficiency bonus + ability modifier", () => {
    expect(calculateSheet(makeTinkerer(1), index).saveDcs).toEqual([
      {
        classId: "tinkerer",
        name: "CD de Inventos",
        ability: "int",
        value: 13,
      },
    ]);
  });

  // SRD 5.2.1, "Bonificador por competencia": +3 desde el nivel 5.
  it("goes up with the proficiency bonus", () => {
    expect(calculateSheet(makeTinkerer(5), index).saveDcs[0]?.value).toBe(14);
  });
});

describe("calculateSheet: tool proficiencies", () => {
  // SRD 5.2.1, "Creación de personajes": el trasfondo da una herramienta; la
  // clase inicial da las suyas.
  it("lists the background tool and the class tools", () => {
    expect(calculateSheet(makeTinkerer(1), index).toolProficiencies).toEqual([
      "Calligrapher's Supplies",
      "Herramientas de hojalatero",
    ]);
  });
});

describe("spendResource", () => {
  it("spends points", () => {
    const result = spendResource(makeTinkerer(2), index, "gear-points", 2);
    expect(result.ok && result.playState.resourcesSpent).toEqual({
      "gear-points": 2,
    });
  });

  it("adds to what was already spent", () => {
    const tinkerer = makeTinkerer(2, {
      playState: { resourcesSpent: { "gear-points": 1 } },
    });
    const result = spendResource(tinkerer, index, "gear-points", 2);
    expect(result.ok && result.playState.resourcesSpent).toEqual({
      "gear-points": 3,
    });
  });

  it("can't spend more than the per-use limit", () => {
    const result = spendResource(makeTinkerer(2), index, "gear-points", 3);
    expect(result).toEqual({
      ok: false,
      reason: "Puntos de engranaje: podés gastar hasta 2 de una vez",
    });
  });

  it("can't spend more than what is left", () => {
    const tinkerer = makeTinkerer(2, {
      playState: { resourcesSpent: { "gear-points": 3 } },
    });
    expect(spendResource(tinkerer, index, "gear-points", 2)).toEqual({
      ok: false,
      reason: "Puntos de engranaje: te queda 1",
    });
  });

  it("needs a whole number from 1", () => {
    for (const amount of [0, -1, 1.5]) {
      expect(
        spendResource(makeTinkerer(), index, "gear-points", amount).ok,
      ).toBe(false);
    }
  });

  it("rejects a resource the character doesn't have", () => {
    expect(spendResource(makeTinkerer(), index, "ki", 1)).toEqual({
      ok: false,
      reason: "El personaje no tiene ese recurso",
    });
  });
});

describe("longRest with resources", () => {
  it("recovers every resource point spent", () => {
    const tired = makeTinkerer(2, {
      playState: { resourcesSpent: { "gear-points": 4 } },
    });
    const result = longRest(tired, index);
    expect(result.ok && result.playState.resourcesSpent).toEqual({});
  });
});
