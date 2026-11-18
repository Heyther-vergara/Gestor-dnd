import { describe, expect, it } from "vitest";

import { srd2024Index as index } from "@/lib/srd-2024";
import {
  calculateSheet,
  classSpellList,
  createContentIndex,
  spellLimits,
} from "@/rules-engine/engine";
import {
  type CharacterInput,
  characterSchema,
  type Content,
  contentSchema,
} from "@/rules-engine/schemas";

// Conjuros del mago con el contenido SRD real (ADR 0021).
// Reglas: SRD 5.2.1, mago, "Lanzamiento de conjuros" (Trucos, Libro de
// conjuros, Conjuros preparados de nivel 1+) y tabla "Rasgos de mago".

const wizard = index.get("wizard") as Extract<Content, { type: "class" }>;

// Ilse: maga humana erudita. El nivel y los conjuros cambian en cada test.
const ilse = (
  classEntry: Partial<CharacterInput["classes"][number]>,
): ReturnType<typeof characterSchema.parse> =>
  characterSchema.parse({
    id: "ilse",
    name: "Ilse",
    edition: "2024",
    activePackageIds: ["srd-2024"],
    classes: [{ classId: "wizard", level: 1, ...classEntry }],
    speciesId: "human",
    backgroundId: "sage",
    baseAbilityScores: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
    choices: [
      {
        kind: "ability-bonus",
        contentId: "sage",
        level: 1,
        bonuses: { int: 2, con: 1 },
      },
    ],
  });

// Los seis recomendados por el SRD para el libro inicial.
const STARTING_BOOK = [
  "detect-magic",
  "feather-fall",
  "mage-armor",
  "magic-missile",
  "sleep",
  "thunderwave",
];
// Los tres trucos recomendados por el SRD.
const STARTING_CANTRIPS = ["light", "mage-hand", "ray-of-frost"];

describe("spellLimits: tabla 'Rasgos de mago'", () => {
  // Trucos: 3 3 3 4 4. Preparados: 4 5 6 7 9. Espacios: hasta nivel 1, 1,
  // 2, 2 y 3. Libro: 6 conjuros y 2 más por cada nivel después del 1.
  it.each([
    [1, { maxSpellLevel: 1, cantrips: 3, prepared: 4, spellbook: 6 }],
    [2, { maxSpellLevel: 1, cantrips: 3, prepared: 5, spellbook: 8 }],
    [3, { maxSpellLevel: 2, cantrips: 3, prepared: 6, spellbook: 10 }],
    [4, { maxSpellLevel: 2, cantrips: 4, prepared: 7, spellbook: 12 }],
    [5, { maxSpellLevel: 3, cantrips: 4, prepared: 9, spellbook: 14 }],
  ])("level %i", (level, limits) => {
    expect(spellLimits(wizard, level)).toEqual(limits);
  });

  it("is null for a class without spellcasting", () => {
    const fighter = index.get("fighter") as Extract<Content, { type: "class" }>;
    expect(spellLimits(fighter, 1)).toBeNull();
  });
});

describe("classSpellList", () => {
  // SRD 5.2.1, "Lista de conjuros de mago", trucos y niveles 1 a 3: los que
  // puede aprender un mago de hasta nivel 5.
  it("has the wizard list up to level 3, sorted by level", () => {
    const list = classSpellList("wizard", index, ["srd-2024"]);
    const byLevel = Object.groupBy(list, (s) => s.data.level);
    expect([0, 1, 2, 3].map((level) => byLevel[level]?.length ?? 0)).toEqual([
      15, 30, 36, 29,
    ]);
    expect(list[0]?.data.level).toBe(0);
    expect(list.at(-1)?.data.level).toBe(3);
  });

  it("is empty for a class without a spell list", () => {
    expect(classSpellList("fighter", index, ["srd-2024"])).toEqual([]);
  });
});

describe("calculateSheet: wizard spells", () => {
  it("lists cantrips, spellbook and prepared spells", () => {
    const sheet = calculateSheet(
      ilse({
        cantripIds: STARTING_CANTRIPS,
        spellbookIds: STARTING_BOOK,
        preparedSpellIds: ["sleep", "mage-armor", "magic-missile", "shield"],
      }),
      index,
    );
    const [stats] = sheet.spellcasting;
    // "Shield" no está en el libro: no se puede preparar.
    expect(sheet.issues).toEqual([
      '"shield" está preparado pero no está en el libro',
    ]);
    expect(stats?.cantrips.map((s) => s.id)).toEqual([
      "light",
      "mage-hand",
      "ray-of-frost",
    ]);
    expect(stats?.spellbook).toHaveLength(6);
    // Ordenados por nivel y nombre.
    expect(stats?.prepared.map((s) => s.name)).toEqual([
      "Mage Armor",
      "Magic Missile",
      "Sleep",
    ]);
  });

  it("has no issues with a full level 1 wizard", () => {
    const sheet = calculateSheet(
      ilse({
        cantripIds: STARTING_CANTRIPS,
        spellbookIds: STARTING_BOOK,
        preparedSpellIds: STARTING_BOOK.slice(0, 4),
      }),
      index,
    );
    expect(sheet.issues).toEqual([]);
    expect(sheet.spellcasting[0]?.limits).toEqual(spellLimits(wizard, 1));
  });

  // Un personaje guardado antes de los conjuros no tiene las listas.
  it("works with a wizard saved before spells existed", () => {
    const sheet = calculateSheet(ilse({}), index);
    expect(sheet.issues).toEqual([]);
    expect(sheet.spellcasting[0]).toMatchObject({
      cantrips: [],
      spellbook: [],
      prepared: [],
    });
  });

  // SRD 5.2.1, "Trucos": "conoces tres trucos de mago".
  it("warns when there are more cantrips than the level allows", () => {
    const sheet = calculateSheet(
      ilse({ cantripIds: [...STARTING_CANTRIPS, "fire-bolt"] }),
      index,
    );
    expect(sheet.issues).toEqual([
      'Hay 4 trucos de "wizard" y el nivel permite 3',
    ]);
  });

  it("rejects a leveled spell as a cantrip and a cantrip in the book", () => {
    const sheet = calculateSheet(
      ilse({ cantripIds: ["sleep"], spellbookIds: ["light"] }),
      index,
    );
    expect(sheet.issues).toEqual([
      '"sleep" no es un truco',
      '"light" es un truco',
    ]);
    expect(sheet.spellcasting[0]?.cantrips).toEqual([]);
    expect(sheet.spellcasting[0]?.spellbook).toEqual([]);
  });

  // SRD 5.2.1, "Libro de conjuros": "cada uno de esos conjuros debe ser de
  // un nivel para el que tengas espacios de conjuro".
  it("rejects spells of a level without slots", () => {
    const sheet = calculateSheet(
      ilse({ level: 2, spellbookIds: ["misty-step"] }),
      index,
    );
    expect(sheet.issues).toEqual([
      '"misty-step" es de nivel 2 y no hay espacios de ese nivel',
    ]);
    // En nivel 3 ya hay espacios de nivel 2.
    const level3 = calculateSheet(
      ilse({ level: 3, spellbookIds: ["misty-step"] }),
      index,
    );
    expect(level3.issues).toEqual([]);
  });

  // SRD 5.2.1, "Conjuros preparados de nivel 1+": cuatro en el nivel 1.
  it("warns when too many spells are prepared", () => {
    const sheet = calculateSheet(
      ilse({ spellbookIds: STARTING_BOOK, preparedSpellIds: STARTING_BOOK }),
      index,
    );
    expect(sheet.issues).toEqual([
      "Hay 6 conjuros preparados y el nivel permite 4",
    ]);
  });

  it("warns when the book has more spells than the level allows", () => {
    const sheet = calculateSheet(
      ilse({ spellbookIds: [...STARTING_BOOK, "shield"] }),
      index,
    );
    expect(sheet.issues).toEqual([
      "El libro tiene 7 conjuros y el nivel permite 6",
    ]);
  });

  it("rejects spells from another list and repeated spells", () => {
    const sheet = calculateSheet(
      ilse({ cantripIds: ["light", "light", "guidance"] }),
      index,
    );
    expect(sheet.issues).toEqual([
      'El conjuro "light" está repetido',
      'No se encontró spell "guidance"',
    ]);
  });
});

// Una clase homebrew que prepara de su lista entera, sin libro (como el
// clérigo del SRD): el motor no le pide libro.
describe("calculateSheet: a class without spellbook", () => {
  const healer = contentSchema.parse({
    id: "healer",
    packageId: "my-homebrew",
    type: "class",
    name: "Sanador",
    description: "",
    data: {
      hitDie: 8,
      primaryAbilities: ["wis"],
      savingThrows: ["wis", "cha"],
      skillChoices: { count: 2, options: ["medicine", "insight"] },
      armorProficiencies: [],
      weaponProficiencies: [],
      spellcasting: {
        ability: "wis",
        preparation: "prepared",
        slotsByLevel: [[2]],
        cantripsByLevel: [2],
        preparedByLevel: [3],
      },
      features: [],
    },
  });
  const cure = contentSchema.parse({
    id: "cure",
    packageId: "my-homebrew",
    type: "spell",
    name: "Cura",
    description: "",
    data: {
      level: 1,
      school: "abjuration",
      castingTime: "Action",
      range: "Touch",
      components: { verbal: true, somatic: false },
      duration: "Instantaneous",
      concentration: false,
      ritual: false,
      classIds: ["healer"],
    },
  });
  const homebrewIndex = createContentIndex([...index.values(), healer, cure]);
  const character = (entry: Partial<CharacterInput["classes"][number]>) =>
    characterSchema.parse({
      ...ilse({}),
      activePackageIds: ["srd-2024", "my-homebrew"],
      classes: [{ classId: "healer", level: 1, ...entry }],
    });

  it("prepares from the class list", () => {
    const sheet = calculateSheet(
      character({ preparedSpellIds: ["cure"] }),
      homebrewIndex,
    );
    expect(sheet.issues).toEqual([]);
    expect(sheet.spellcasting[0]?.spellbook).toBeNull();
    expect(sheet.spellcasting[0]?.prepared.map((s) => s.id)).toEqual(["cure"]);
  });

  it("warns about a spellbook", () => {
    const sheet = calculateSheet(
      character({ spellbookIds: ["cure"] }),
      homebrewIndex,
    );
    expect(sheet.issues).toEqual([
      'La clase "healer" no usa libro de conjuros',
    ]);
  });
});
