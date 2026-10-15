import { describe, expect, it } from "vitest";

import {
  abilityModifier,
  applyNumericEffects,
  calculateSheet,
  createContentIndex,
  isNumericEffect,
} from "@/rules-engine/engine";
import {
  type Character,
  characterSchema,
  type Choice,
  type Content,
  contentSchema,
  type Effect,
  effectSchema,
} from "@/rules-engine/schemas";

// --- Contenido de prueba ---
// Se pasa por contentSchema.parse para que los ejemplos sean contenido válido de verdad.

const content = (raw: unknown): Content => contentSchema.parse(raw);

const dwarf = content({
  id: "dwarf",
  packageId: "srd-2024",
  type: "species",
  name: "Enano",
  description: "",
  data: { size: ["medium"], speed: 30, traits: [] },
});

const soldier = content({
  id: "soldier",
  packageId: "srd-2024",
  type: "background",
  name: "Soldado",
  description: "",
  data: {
    abilityOptions: ["str", "dex", "con"],
    featId: "savage-attacker",
    skillProficiencies: ["athletics", "intimidation"],
    toolProficiency: "Gaming Set",
    equipment: "",
  },
});

const savageAttacker = content({
  id: "savage-attacker",
  packageId: "srd-2024",
  type: "feat",
  name: "Atacante salvaje",
  description: "",
  data: { category: "origin" },
});

const classData = {
  primaryAbilities: ["str"],
  savingThrows: ["str", "con"],
  skillChoices: { count: 2, options: ["athletics", "perception"] },
  armorProficiencies: [],
  weaponProficiencies: [],
};

const fighter = content({
  id: "fighter",
  packageId: "srd-2024",
  type: "class",
  name: "Guerrero",
  description: "",
  data: { ...classData, hitDie: 10, features: [] },
});

// SRD 5.2.1, bárbaro, "Defensa sin armadura" (nivel 1): sin armadura, CA base
// 10 + Des + Con, aunque lleve escudo (ver ADR 0003).
const barbarian = content({
  id: "barbarian",
  packageId: "srd-2024",
  type: "class",
  name: "Bárbaro",
  description: "",
  data: {
    ...classData,
    hitDie: 12,
    features: [
      {
        level: 1,
        name: "Defensa sin armadura",
        description: "",
        effects: [
          {
            target: "ac",
            op: "base",
            value: 10,
            abilities: ["dex", "con"],
            condition: "unarmored",
          },
        ],
      },
    ],
  },
});

// SRD 5.2.1, monje, "Defensa sin armadura" (nivel 1): sin armadura ni escudo,
// CA base 10 + Des + Sab (ver ADR 0003).
const monk = content({
  id: "monk",
  packageId: "srd-2024",
  type: "class",
  name: "Monje",
  description: "",
  data: {
    ...classData,
    hitDie: 8,
    features: [
      {
        level: 1,
        name: "Defensa sin armadura",
        description: "",
        effects: [
          {
            target: "ac",
            op: "base",
            value: 10,
            abilities: ["dex", "wis"],
            condition: "unarmored-no-shield",
          },
        ],
      },
    ],
  },
});

// SRD 5.2.1, "Armaduras": cota de malla 16 · armadura de cuero 11 + Des ·
// coraza 14 + Des (máx. 2) · escudo +2.
const armor = (
  id: string,
  armorCategory: "light" | "medium" | "heavy",
  acEffect: Effect,
) =>
  content({
    id,
    packageId: "srd-2024",
    type: "item",
    name: id,
    description: "",
    effects: [acEffect],
    data: {
      category: "armor",
      armor: { armorCategory, stealthDisadvantage: false },
    },
  });

const chainMail = armor("chain-mail", "heavy", {
  target: "ac",
  op: "base",
  value: 16,
});
const leather = armor("leather-armor", "light", {
  target: "ac",
  op: "base",
  value: 11,
  abilities: ["dex"],
});
const breastplate = armor("breastplate", "medium", {
  target: "ac",
  op: "base",
  value: 14,
  abilities: ["dex"],
  maxAbilityBonus: 2,
});

const shield = content({
  id: "shield",
  packageId: "srd-2024",
  type: "item",
  name: "Escudo",
  description: "",
  effects: [{ target: "ac", op: "add", value: 2 }],
  data: { category: "shield" },
});

// SRD 5.2.1, "Anillo de protección": +1 a la CA y a las tiradas de salvación;
// requiere sintonización.
const ringOfProtection = content({
  id: "ring-of-protection",
  packageId: "srd-2024",
  type: "item",
  name: "Anillo de protección",
  description: "",
  effects: [
    { target: "ac", op: "add", value: 1 },
    ...(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => ({
      target: `save.${a}`,
      op: "add",
      value: 1,
    })),
  ],
  data: { category: "magic", requiresAttunement: true },
});

// Homebrew: objetos inventados para probar efectos que el SRD no usa todavía.
const homebrewBelt = content({
  id: "belt-of-might",
  packageId: "my-homebrew",
  type: "item",
  name: "Cinturón del poder",
  description: "+1 a Fuerza",
  effects: [{ target: "ability.str", op: "add", value: 1 }],
  data: { category: "magic" },
});

// SRD 5.2.1, mago: competencia en salvaciones de Inteligencia y Sabiduría.
// "Erudito" (nivel 2): pericia en una habilidad de conocimiento en la que ya
// seas competente.
const wizard = content({
  id: "wizard",
  packageId: "srd-2024",
  type: "class",
  name: "Mago",
  description: "",
  data: {
    ...classData,
    savingThrows: ["int", "wis"],
    skillChoices: {
      count: 2,
      options: [
        "arcana",
        "history",
        "insight",
        "investigation",
        "medicine",
        "nature",
        "religion",
      ],
    },
    hitDie: 6,
    features: [],
  },
});

// Homebrew: concede competencias con efectos "grant".
const sentinelCloak = content({
  id: "sentinel-cloak",
  packageId: "my-homebrew",
  type: "item",
  name: "Capa del centinela",
  description: "Competencia en salvaciones de Sabiduría y en Sigilo",
  effects: [
    { target: "proficiency.save.wis", op: "grant" },
    { target: "proficiency.skill.stealth", op: "grant" },
  ],
  data: { category: "magic" },
});

// Homebrew: +2 a Sigilo, para probar efectos numéricos sobre habilidades.
const quietBoots = content({
  id: "quiet-boots",
  packageId: "my-homebrew",
  type: "item",
  name: "Botas silenciosas",
  description: "+2 a Sigilo",
  effects: [{ target: "skill.stealth", op: "add", value: 2 }],
  data: { category: "magic" },
});

const index = createContentIndex([
  wizard,
  sentinelCloak,
  quietBoots,
  dwarf,
  soldier,
  savageAttacker,
  fighter,
  barbarian,
  monk,
  chainMail,
  leather,
  breastplate,
  shield,
  ringOfProtection,
  homebrewBelt,
]);

// --- Personaje de ejemplo: Brunhilda, guerrera enana soldado de nivel 3 ---

type CharacterInput = Partial<Omit<Character, "baseAbilityScores">> & {
  baseAbilityScores?: Partial<Character["baseAbilityScores"]>;
};

const makeCharacter = (overrides: CharacterInput = {}): Character => {
  const { baseAbilityScores, ...rest } = overrides;
  return characterSchema.parse({
    id: "char-1",
    name: "Brunhilda",
    edition: "2024",
    activePackageIds: ["srd-2024"],
    classes: [{ classId: "fighter", level: 3 }],
    speciesId: "dwarf",
    backgroundId: "soldier",
    choices: [],
    inventory: [],
    ...rest,
    baseAbilityScores: {
      str: 15,
      dex: 14,
      con: 13,
      int: 8,
      wis: 12,
      cha: 10,
      ...baseAbilityScores,
    },
  });
};

const equipped = (...itemIds: string[]) =>
  itemIds.map((itemId) => ({
    itemId,
    quantity: 1,
    equipped: true,
    attuned: false,
  }));

// --- Tests ---

describe("abilityModifier", () => {
  // SRD 5.2.1, tabla "Puntuaciones y modificadores de característica":
  // 1 → −5 · 2–3 → −4 · 8–9 → −1 · 10–11 → +0 · 12–13 → +1 · 20–21 → +5 · 30 → +10.
  it.each([
    [1, -5],
    [3, -4],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [12, 1],
    [15, 2],
    [20, 5],
    [30, 10],
  ])("score %i → modifier %i", (score, modifier) => {
    expect(abilityModifier(score)).toBe(modifier);
  });
});

describe("calculateSheet: ability scores", () => {
  it("uses the base scores when there are no bonuses", () => {
    const sheet = calculateSheet(makeCharacter(), index);
    expect(sheet.abilities.str).toEqual({ score: 15, modifier: 2 });
    expect(sheet.abilities.int).toEqual({ score: 8, modifier: -1 });
    expect(sheet.issues).toEqual([]);
  });

  // SRD 5.2.1, "Crear un personaje", trasfondo: aumentá una de sus tres
  // características en 2 y otra en 1, o las tres en 1.
  it("applies the background +2/+1", () => {
    const sheet = calculateSheet(
      makeCharacter({
        choices: [
          {
            kind: "ability-bonus",
            contentId: "soldier",
            level: 1,
            bonuses: { str: 2, con: 1 },
          },
        ],
      }),
      index,
    );
    expect(sheet.abilities.str).toEqual({ score: 17, modifier: 3 });
    expect(sheet.abilities.con).toEqual({ score: 14, modifier: 2 });
  });

  // SRD 5.2.1, mismo paso: ninguna puntuación puede subir por encima de 20.
  it("does not raise a score above 20 with the background bonus", () => {
    const sheet = calculateSheet(
      makeCharacter({
        baseAbilityScores: { str: 19 },
        choices: [
          {
            kind: "ability-bonus",
            contentId: "soldier",
            level: 1,
            bonuses: { str: 2, con: 1 },
          },
        ],
      }),
      index,
    );
    expect(sheet.abilities.str.score).toBe(20);
  });

  it("ignores a bonus to an ability the background does not offer", () => {
    const sheet = calculateSheet(
      makeCharacter({
        choices: [
          {
            kind: "ability-bonus",
            contentId: "soldier",
            level: 1,
            bonuses: { wis: 2, con: 1 },
          },
        ],
      }),
      index,
    );
    expect(sheet.abilities.wis.score).toBe(12);
    expect(sheet.abilities.con.score).toBe(13);
    expect(sheet.issues).toHaveLength(1);
  });

  it("applies ability effects from equipped items", () => {
    const sheet = calculateSheet(
      makeCharacter({
        activePackageIds: ["srd-2024", "my-homebrew"],
        inventory: equipped("belt-of-might"),
      }),
      index,
    );
    expect(sheet.abilities.str).toEqual({ score: 16, modifier: 3 });
  });

  it("ignores content from inactive packages", () => {
    const sheet = calculateSheet(
      makeCharacter({ inventory: equipped("belt-of-might") }),
      index,
    );
    expect(sheet.abilities.str.score).toBe(15);
    expect(sheet.issues).toHaveLength(1);
  });
});

describe("calculateSheet: armor class", () => {
  // SRD 5.2.1, glosario, "Clase de armadura": sin armadura, la CA base es 10 + Des.
  it("is 10 + Dex without armor", () => {
    expect(calculateSheet(makeCharacter(), index).ac).toBe(12);
  });

  // docs/plan.md: "Guerrero nivel 3, Des 14, cota de mallas → CA 16".
  it("is 16 with chain mail, ignoring Dex", () => {
    const sheet = calculateSheet(
      makeCharacter({ inventory: equipped("chain-mail") }),
      index,
    );
    expect(sheet.ac).toBe(16);
  });

  it("is 11 + Dex with leather armor", () => {
    const sheet = calculateSheet(
      makeCharacter({
        baseAbilityScores: { dex: 16 },
        inventory: equipped("leather-armor"),
      }),
      index,
    );
    expect(sheet.ac).toBe(14);
  });

  it("caps the Dex bonus at +2 with a breastplate", () => {
    const sheet = calculateSheet(
      makeCharacter({
        baseAbilityScores: { dex: 18 },
        inventory: equipped("breastplate"),
      }),
      index,
    );
    expect(sheet.ac).toBe(16);
  });

  it("does not cap a negative Dex modifier", () => {
    const sheet = calculateSheet(
      makeCharacter({
        baseAbilityScores: { dex: 8 },
        inventory: equipped("breastplate"),
      }),
      index,
    );
    expect(sheet.ac).toBe(13);
  });

  it("adds +2 for a shield", () => {
    const sheet = calculateSheet(
      makeCharacter({ inventory: equipped("chain-mail", "shield") }),
      index,
    );
    expect(sheet.ac).toBe(18);
  });

  it("ignores armor that is carried but not equipped", () => {
    const sheet = calculateSheet(
      makeCharacter({
        inventory: [
          {
            itemId: "chain-mail",
            quantity: 1,
            equipped: false,
            attuned: false,
          },
        ],
      }),
      index,
    );
    expect(sheet.ac).toBe(12);
  });

  it("ignores an item that requires attunement until attuned", () => {
    const notAttuned = calculateSheet(
      makeCharacter({ inventory: equipped("ring-of-protection") }),
      index,
    );
    const attuned = calculateSheet(
      makeCharacter({
        inventory: [
          {
            itemId: "ring-of-protection",
            quantity: 1,
            equipped: true,
            attuned: true,
          },
        ],
      }),
      index,
    );
    expect(notAttuned.ac).toBe(12);
    expect(attuned.ac).toBe(13);
  });

  describe("barbarian Unarmored Defense (10 + Dex + Con)", () => {
    const barbarianWith = (inventory: Character["inventory"]) =>
      makeCharacter({
        classes: [{ classId: "barbarian", level: 1 }],
        baseAbilityScores: { dex: 14, con: 16 },
        inventory,
      });

    it("applies without armor", () => {
      expect(calculateSheet(barbarianWith([]), index).ac).toBe(15);
    });

    it("still applies with a shield", () => {
      expect(calculateSheet(barbarianWith(equipped("shield")), index).ac).toBe(
        17,
      );
    });

    it("does not apply while wearing armor", () => {
      const sheet = calculateSheet(
        barbarianWith(equipped("leather-armor")),
        index,
      );
      expect(sheet.ac).toBe(13);
    });

    // ADR 0003: entre las bases que aplican se usa la mayor, incluida 10 + Des.
    it("loses to 10 + Dex when Con is negative", () => {
      const sheet = calculateSheet(
        makeCharacter({
          classes: [{ classId: "barbarian", level: 1 }],
          baseAbilityScores: { dex: 14, con: 8 },
        }),
        index,
      );
      expect(sheet.ac).toBe(12);
    });
  });

  describe("monk Unarmored Defense (10 + Dex + Wis)", () => {
    const monkWith = (inventory: Character["inventory"]) =>
      makeCharacter({
        classes: [{ classId: "monk", level: 1 }],
        baseAbilityScores: { dex: 16, wis: 16 },
        inventory,
      });

    it("applies without armor or shield", () => {
      expect(calculateSheet(monkWith([]), index).ac).toBe(16);
    });

    it("does not apply with a shield", () => {
      expect(calculateSheet(monkWith(equipped("shield")), index).ac).toBe(15);
    });
  });
});

describe("calculateSheet: proficiency bonus", () => {
  // SRD 5.2.1, "Cómo jugar", tabla "Bonificador por competencia":
  // hasta 4 → +2 · 5–8 → +3 · 9–12 → +4 · 13–16 → +5 · 17–20 → +6.
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [8, 3],
    [9, 4],
    [12, 4],
    [13, 5],
    [16, 5],
    [17, 6],
    [20, 6],
  ])("level %i → +%i", (level, bonus) => {
    const sheet = calculateSheet(
      makeCharacter({ classes: [{ classId: "fighter", level }] }),
      index,
    );
    expect(sheet.proficiencyBonus).toBe(bonus);
  });

  // SRD 5.2.1, "Multiclase", "Bonificador por competencia": se basa en el nivel
  // total del personaje. "Guerrere de nivel 3/pícare de nivel 2 … +3".
  it("uses the total character level when multiclassing", () => {
    const sheet = calculateSheet(
      makeCharacter({
        classes: [
          { classId: "fighter", level: 3 },
          { classId: "wizard", level: 2 },
        ],
      }),
      index,
    );
    expect(sheet.proficiencyBonus).toBe(3);
  });

  it("reports a total level above 20", () => {
    const sheet = calculateSheet(
      makeCharacter({
        classes: [
          { classId: "fighter", level: 15 },
          { classId: "wizard", level: 10 },
        ],
      }),
      index,
    );
    expect(sheet.proficiencyBonus).toBe(6);
    expect(sheet.issues).toHaveLength(1);
  });
});

describe("calculateSheet: saving throws", () => {
  // SRD 5.2.1, "Creación de personajes", "Rellena los números": en las
  // salvaciones en las que sos competente, modificador + bonificador por
  // competencia; en las demás, solo el modificador.
  it("adds the proficiency bonus to the class saving throws", () => {
    // Guerrero nivel 3 (+2): Fue 15 (+2) y Con 13 (+1) competentes.
    const sheet = calculateSheet(makeCharacter(), index);
    expect(sheet.savingThrows.str).toEqual({ modifier: 4, proficient: true });
    expect(sheet.savingThrows.con).toEqual({ modifier: 3, proficient: true });
    expect(sheet.savingThrows.dex).toEqual({ modifier: 2, proficient: false });
    expect(sheet.savingThrows.int).toEqual({ modifier: -1, proficient: false });
  });

  // SRD 5.2.1, "Convertirse en bárbaro", "Como personaje multiclase": solo se
  // obtienen algunos atributos de la clase nueva, y las salvaciones no están.
  it("only uses the saving throws of the starting class", () => {
    const sheet = calculateSheet(
      makeCharacter({
        classes: [
          { classId: "fighter", level: 3 },
          { classId: "wizard", level: 2 },
        ],
      }),
      index,
    );
    expect(sheet.savingThrows.str.proficient).toBe(true);
    expect(sheet.savingThrows.int.proficient).toBe(false);
    expect(sheet.savingThrows.wis.proficient).toBe(false);
  });

  it("grants saving throw proficiency from effects", () => {
    const sheet = calculateSheet(
      makeCharacter({
        activePackageIds: ["srd-2024", "my-homebrew"],
        inventory: equipped("sentinel-cloak"),
      }),
      index,
    );
    expect(sheet.savingThrows.wis).toEqual({ modifier: 3, proficient: true });
  });

  // SRD 5.2.1, "Anillo de protección": +1 a la CA y a las tiradas de salvación.
  it("applies numeric effects on saving throws", () => {
    const sheet = calculateSheet(
      makeCharacter({
        inventory: [
          {
            itemId: "ring-of-protection",
            quantity: 1,
            equipped: true,
            attuned: true,
          },
        ],
      }),
      index,
    );
    expect(sheet.savingThrows.str.modifier).toBe(5);
    expect(sheet.savingThrows.dex.modifier).toBe(3);
  });
});

describe("calculateSheet: skills", () => {
  const fighterSkills: Choice = {
    kind: "skills",
    contentId: "fighter",
    level: 1,
    skills: ["perception", "athletics"],
  };

  // SRD 5.2.1, "Creación de personajes", "Rellena los números": en las
  // habilidades en las que sos competente, modificador de la característica
  // asociada + bonificador por competencia; en las demás, solo el modificador.
  it("uses only the ability modifier without proficiency", () => {
    const sheet = calculateSheet(makeCharacter(), index);
    // Sigilo usa Destreza (tabla "Habilidades"): Des 14 → +2.
    expect(sheet.skills.stealth).toEqual({
      ability: "dex",
      modifier: 2,
      proficiency: "none",
    });
    expect(sheet.skills.arcana.modifier).toBe(-1);
  });

  // SRD 5.2.1, "Creación de personajes": el trasfondo da competencia en dos
  // habilidades. Soldado: Atletismo e Intimidación.
  it("adds the proficiency bonus to background skills", () => {
    const sheet = calculateSheet(makeCharacter(), index);
    expect(sheet.skills.athletics).toEqual({
      ability: "str",
      modifier: 4,
      proficiency: "proficient",
    });
    expect(sheet.skills.intimidation.modifier).toBe(2);
  });

  it("adds the proficiency bonus to skills chosen from the class", () => {
    const sheet = calculateSheet(
      makeCharacter({ choices: [fighterSkills] }),
      index,
    );
    // Sab 12 (+1) + 2.
    expect(sheet.skills.perception).toEqual({
      ability: "wis",
      modifier: 3,
      proficiency: "proficient",
    });
    expect(sheet.issues).toEqual([]);
  });

  // SRD 5.2.1, "El bonificador no se acumula": Atletismo viene del trasfondo y
  // de la clase, pero el bonificador se suma una sola vez.
  it("does not add the proficiency bonus twice", () => {
    const sheet = calculateSheet(
      makeCharacter({ choices: [fighterSkills] }),
      index,
    );
    expect(sheet.skills.athletics.modifier).toBe(4);
  });

  it("ignores a class skill outside the class options", () => {
    const sheet = calculateSheet(
      makeCharacter({
        choices: [
          {
            kind: "skills",
            contentId: "fighter",
            level: 1,
            skills: ["arcana"],
          },
        ],
      }),
      index,
    );
    expect(sheet.skills.arcana.proficiency).toBe("none");
    expect(sheet.issues).toHaveLength(1);
  });

  it("ignores more class skills than the class allows", () => {
    const sheet = calculateSheet(
      makeCharacter({
        classes: [{ classId: "wizard", level: 1 }],
        choices: [
          {
            kind: "skills",
            contentId: "wizard",
            level: 1,
            skills: ["arcana", "history", "nature"],
          },
        ],
      }),
      index,
    );
    expect(sheet.skills.arcana.proficiency).toBe("none");
    expect(sheet.issues).toHaveLength(1);
  });

  it("ignores skills chosen from content the character does not have", () => {
    const sheet = calculateSheet(
      makeCharacter({
        choices: [
          { kind: "skills", contentId: "wizard", level: 1, skills: ["arcana"] },
        ],
      }),
      index,
    );
    expect(sheet.skills.arcana.proficiency).toBe("none");
    expect(sheet.issues).toHaveLength(1);
  });

  it("grants skill proficiency from effects and applies skill bonuses", () => {
    const sheet = calculateSheet(
      makeCharacter({
        activePackageIds: ["srd-2024", "my-homebrew"],
        inventory: equipped("sentinel-cloak", "quiet-boots"),
      }),
      index,
    );
    // Des +2, competencia +2, botas +2.
    expect(sheet.skills.stealth).toEqual({
      ability: "dex",
      modifier: 6,
      proficiency: "proficient",
    });
  });

  describe("expertise", () => {
    // Maga de nivel 2 (+2) con Int 16 (+3), competente en Conocimiento arcano
    // e Historia, y "Erudito" en Conocimiento arcano.
    const scholar = (expertise: ("arcana" | "nature")[]) =>
      makeCharacter({
        classes: [{ classId: "wizard", level: 2 }],
        baseAbilityScores: { int: 16 },
        choices: [
          {
            kind: "skills",
            contentId: "wizard",
            level: 1,
            skills: ["arcana", "history"],
          },
          {
            kind: "expertise",
            contentId: "wizard",
            level: 2,
            skills: expertise,
          },
        ],
      });

    // SRD 5.2.1, glosario, "Pericia": el bonificador por competencia se duplica
    // en las pruebas con esa habilidad.
    it("doubles the proficiency bonus", () => {
      const sheet = calculateSheet(scholar(["arcana"]), index);
      expect(sheet.skills.arcana).toEqual({
        ability: "int",
        modifier: 7,
        proficiency: "expertise",
      });
      expect(sheet.skills.history.modifier).toBe(5);
      expect(sheet.issues).toEqual([]);
    });

    // SRD 5.2.1, glosario, "Pericia": la ganás en una habilidad en la que
    // tengas competencia.
    it("is ignored in a skill without proficiency", () => {
      const sheet = calculateSheet(scholar(["nature"]), index);
      expect(sheet.skills.nature.proficiency).toBe("none");
      expect(sheet.skills.nature.modifier).toBe(3);
      expect(sheet.issues).toHaveLength(1);
    });
  });

  // SRD 5.2.1, "Rellena los números": Percepción pasiva = 10 + modificador
  // para pruebas de Sabiduría (Percepción).
  it("calculates passive Perception", () => {
    const without = calculateSheet(makeCharacter(), index);
    const withProficiency = calculateSheet(
      makeCharacter({ choices: [fighterSkills] }),
      index,
    );
    expect(without.passivePerception).toBe(11);
    expect(withProficiency.passivePerception).toBe(13);
  });
});

describe("applyNumericEffects", () => {
  const modifiers = { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0 };
  const effects = (...raw: unknown[]) =>
    raw.map((e) => effectSchema.parse(e)).filter(isNumericEffect);

  it("applies base → set → add → multiply → min → max", () => {
    const result = applyNumericEffects(
      10,
      effects(
        { target: "speed", op: "base", value: 25 },
        { target: "speed", op: "add", value: 10 },
        { target: "speed", op: "multiply", value: 2 },
      ),
      modifiers,
    );
    expect(result).toBe(70);
  });

  it("set replaces the base", () => {
    const result = applyNumericEffects(
      30,
      effects(
        { target: "speed", op: "set", value: 0 },
        { target: "speed", op: "add", value: 10 },
      ),
      modifiers,
    );
    expect(result).toBe(10);
  });

  // Redondeo hacia abajo, como toda división en 5e.
  it("rounds down after multiply", () => {
    const result = applyNumericEffects(
      15,
      effects({ target: "speed", op: "multiply", value: 0.5 }),
      modifiers,
    );
    expect(result).toBe(7);
  });

  // "min": el valor no puede bajar de X. "max": no puede pasar de X.
  it("min sets a floor and max sets a ceiling", () => {
    const floor = applyNumericEffects(
      12,
      effects({ target: "ac", op: "min", value: 16 }),
      modifiers,
    );
    const ceiling = applyNumericEffects(
      40,
      effects({ target: "speed", op: "max", value: 30 }),
      modifiers,
    );
    expect(floor).toBe(16);
    expect(ceiling).toBe(30);
  });
});
