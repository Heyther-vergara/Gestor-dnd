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
  type CharacterInput,
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

// SRD 5.2.1, enano, "Aguante enano": tus PG máximos aumentan en 1, y en 1 más
// cada vez que subas un nivel.
const dwarf = content({
  id: "dwarf",
  packageId: "srd-2024",
  type: "species",
  name: "Enano",
  description: "",
  data: {
    size: ["medium"],
    speed: 30,
    traits: [
      {
        name: "Aguante enano",
        description: "",
        effects: [{ target: "hp.max-per-level", op: "add", value: 1 }],
      },
      // SRD 5.2.1, enano, "Visión en la oscuridad": 36 m (120 pies).
      {
        name: "Visión en la oscuridad",
        description: "",
        effects: [{ target: "senses.darkvision", op: "base", value: 120 }],
      },
    ],
  },
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

// SRD 5.2.1, "Atributos básicos de guerrero": entrenamiento con armaduras
// ligeras, medias y pesadas y escudos. "Convertirse en guerrero", "Como
// personaje multiclase": solo armaduras ligeras y medias y escudos.
const fighter = content({
  id: "fighter",
  packageId: "srd-2024",
  type: "class",
  name: "Guerrero",
  description: "",
  data: {
    ...classData,
    hitDie: 10,
    armorProficiencies: ["light", "medium", "heavy", "shield"],
    multiclassArmorProficiencies: ["light", "medium", "shield"],
    features: [],
  },
});

// SRD 5.2.1, bárbaro, "Defensa sin armadura" (nivel 1): sin armadura, CA base
// 10 + Des + Con, aunque lleve escudo (ver ADR 0003). Entrenamiento con
// armaduras ligeras y medias y escudos.
const barbarian = content({
  id: "barbarian",
  packageId: "srd-2024",
  type: "class",
  name: "Bárbaro",
  description: "",
  data: {
    ...classData,
    hitDie: 12,
    armorProficiencies: ["light", "medium", "shield"],
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

// SRD 5.2.1, "Armaduras": cota de malla 16, Fuerza 13 · armadura de cuero
// 11 + Des · coraza 14 + Des (máx. 2) · escudo +2.
const armor = (
  id: string,
  armorCategory: "light" | "medium" | "heavy",
  acEffect: Effect,
  strengthRequirement?: number,
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
      armor: { armorCategory, strengthRequirement, stealthDisadvantage: false },
    },
  });

const chainMail = armor(
  "chain-mail",
  "heavy",
  { target: "ac", op: "base", value: 16 },
  13,
);
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
    // SRD 5.2.1, mago: "La Inteligencia es tu aptitud mágica".
    spellcasting: { ability: "int", preparation: "prepared" },
    features: [],
  },
});

// SRD 5.2.1, clérigo: dado de golpe d8, Sabiduría como aptitud mágica,
// entrenamiento con armaduras ligeras y medias y escudos.
const cleric = content({
  id: "cleric",
  packageId: "srd-2024",
  type: "class",
  name: "Clérigo",
  description: "",
  data: {
    ...classData,
    savingThrows: ["wis", "cha"],
    hitDie: 8,
    armorProficiencies: ["light", "medium", "shield"],
    spellcasting: { ability: "wis", preparation: "prepared" },
    features: [],
  },
});

// SRD 5.2.1, trasfondo "Criminal": dote Alerta.
const criminal = content({
  id: "criminal",
  packageId: "srd-2024",
  type: "background",
  name: "Criminal",
  description: "",
  data: {
    abilityOptions: ["dex", "con", "int"],
    featId: "alert",
    skillProficiencies: ["sleight-of-hand", "stealth"],
    toolProficiency: "Thieves' Tools",
    equipment: "",
  },
});

// SRD 5.2.1, dote "Alerta", "Competencia en iniciativa": cuando tires
// iniciativa, podés sumar tu bonificador por competencia.
const alert = content({
  id: "alert",
  packageId: "srd-2024",
  type: "feat",
  name: "Alerta",
  description: "",
  effects: [{ target: "proficiency.initiative", op: "grant" }],
  data: { category: "origin" },
});

// Homebrew: un efecto sobre cada valor nuevo de la hoja, para probarlos.
const adventurerCharm = content({
  id: "adventurer-charm",
  packageId: "my-homebrew",
  type: "item",
  name: "Talismán del aventurero",
  description: "",
  effects: [
    { target: "initiative", op: "add", value: 1 },
    { target: "speed", op: "add", value: 10 },
    { target: "hp.max", op: "add", value: 5 },
    { target: "spell.dc", op: "add", value: 1 },
    { target: "spell.attack", op: "add", value: 1 },
  ],
  data: { category: "magic" },
});

// Homebrew: amplía la visión en la oscuridad que ya tengas.
const owlEyes = content({
  id: "owl-eyes",
  packageId: "my-homebrew",
  type: "item",
  name: "Ojos de búho",
  description: "+30 pies a la visión en la oscuridad",
  effects: [{ target: "senses.darkvision", op: "add", value: 30 }],
  data: { category: "magic" },
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

// Homebrew: concede entrenamiento con armaduras pesadas.
const knightGauntlets = content({
  id: "knight-gauntlets",
  packageId: "my-homebrew",
  type: "item",
  name: "Guanteletes del caballero",
  description: "Entrenamiento con armaduras pesadas",
  effects: [{ target: "proficiency.armor.heavy", op: "grant" }],
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
  cleric,
  criminal,
  alert,
  adventurerCharm,
  sentinelCloak,
  quietBoots,
  knightGauntlets,
  owlEyes,
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

type CharacterOverrides = Partial<Omit<CharacterInput, "baseAbilityScores">> & {
  baseAbilityScores?: Partial<Character["baseAbilityScores"]>;
};

const makeCharacter = (overrides: CharacterOverrides = {}): Character => {
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

    // El monje no tiene entrenamiento con escudos, así que el escudo tampoco
    // suma: queda 10 + Des.
    it("does not apply with a shield", () => {
      expect(calculateSheet(monkWith(equipped("shield")), index).ac).toBe(13);
    });
  });
});

describe("calculateSheet: armor training", () => {
  const noPenalties = {
    untrainedArmor: false,
    untrainedShield: false,
    insufficientStrength: false,
  };
  const wizardWith = (
    inventory: Character["inventory"],
    overrides: CharacterOverrides = {},
  ) =>
    makeCharacter({
      classes: [{ classId: "wizard", level: 1 }],
      baseAbilityScores: { str: 13, int: 16 },
      inventory,
      ...overrides,
    });

  it("has no penalties with armor the class is trained in", () => {
    const sheet = calculateSheet(
      makeCharacter({ inventory: equipped("chain-mail", "shield") }),
      index,
    );
    expect(sheet.armorPenalties).toEqual(noPenalties);
  });

  it("has no penalties without armor", () => {
    expect(calculateSheet(wizardWith([]), index).armorPenalties).toEqual(
      noPenalties,
    );
  });

  // SRD 5.2.1, "Entrenamiento con armaduras", "Armaduras ligeras, medias o
  // pesadas": sin entrenamiento tenés desventaja en las pruebas con d20 de
  // Fuerza o Destreza y no podés lanzar conjuros. La CA se aplica igual.
  describe("armor without training", () => {
    const sheet = calculateSheet(wizardWith(equipped("chain-mail")), index);

    it("keeps the armor's AC", () => {
      expect(sheet.ac).toBe(16);
    });

    it("marks the armor as untrained", () => {
      expect(sheet.armorPenalties.untrainedArmor).toBe(true);
    });

    it("prevents casting spells", () => {
      expect(sheet.spellcasting[0]?.canCast).toBe(false);
    });

    it("is not a data issue", () => {
      expect(sheet.issues).toEqual([]);
    });
  });

  // SRD 5.2.1, "Entrenamiento con armaduras", "Escudos": solo obtenés el
  // bonificador a la CA si tenés entrenamiento con escudos.
  it("ignores the shield's AC bonus without shield training", () => {
    const sheet = calculateSheet(wizardWith(equipped("shield")), index);
    expect(sheet.ac).toBe(12);
    expect(sheet.armorPenalties.untrainedShield).toBe(true);
    // El escudo no impide lanzar conjuros; solo la armadura.
    expect(sheet.spellcasting[0]?.canCast).toBe(true);
  });

  describe("multiclass", () => {
    // SRD 5.2.1, "Convertirse en guerrero", "Como personaje multiclase":
    // entrenamiento con armaduras ligeras y medias y escudos, no pesadas.
    const wizardFighter = (...itemIds: string[]) =>
      wizardWith(equipped(...itemIds), {
        classes: [
          { classId: "wizard", level: 1 },
          { classId: "fighter", level: 1 },
        ],
      });

    it("gets medium armor and shield training from a later fighter level", () => {
      const sheet = calculateSheet(
        wizardFighter("breastplate", "shield"),
        index,
      );
      expect(sheet.armorPenalties).toEqual(noPenalties);
      expect(sheet.spellcasting[0]?.canCast).toBe(true);
    });

    it("does not get heavy armor training from a later fighter level", () => {
      const sheet = calculateSheet(wizardFighter("chain-mail"), index);
      expect(sheet.armorPenalties.untrainedArmor).toBe(true);
    });

    it("keeps the full training of the starting class", () => {
      const sheet = calculateSheet(
        makeCharacter({
          classes: [
            { classId: "fighter", level: 1 },
            { classId: "wizard", level: 1 },
          ],
          inventory: equipped("chain-mail"),
        }),
        index,
      );
      expect(sheet.armorPenalties.untrainedArmor).toBe(false);
    });
  });

  it("grants armor training from effects", () => {
    const sheet = calculateSheet(
      wizardWith(equipped("chain-mail", "knight-gauntlets"), {
        activePackageIds: ["srd-2024", "my-homebrew"],
      }),
      index,
    );
    expect(sheet.armorPenalties.untrainedArmor).toBe(false);
    expect(sheet.spellcasting[0]?.canCast).toBe(true);
  });

  // SRD 5.2.1, "Entrenamiento con armaduras", "Solo un tipo": no se puede
  // llevar más de una armadura ni embrazar más de un escudo a la vez.
  it("reports two armors worn at once and keeps the best", () => {
    const sheet = calculateSheet(
      makeCharacter({ inventory: equipped("leather-armor", "chain-mail") }),
      index,
    );
    expect(sheet.ac).toBe(16);
    expect(sheet.issues).toEqual([
      "Hay 2 armaduras equipadas; solo se puede llevar una",
    ]);
  });

  it("reports two shields held at once and counts only one", () => {
    const sheet = calculateSheet(
      makeCharacter({ inventory: equipped("chain-mail", "shield", "shield") }),
      index,
    );
    expect(sheet.ac).toBe(18);
    expect(sheet.issues).toEqual([
      "Hay 2 escudos equipados; solo se puede embrazar uno",
    ]);
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

describe("calculateSheet: initiative", () => {
  // SRD 5.2.1, "Rellena los números", "Iniciativa": tu modificador por Destreza.
  it("is the Dexterity modifier", () => {
    expect(calculateSheet(makeCharacter(), index).initiative).toBe(2);
  });

  // SRD 5.2.1, dote "Alerta": sumás tu bonificador por competencia a la
  // iniciativa. Se calcula, así que sube solo con el nivel.
  it("adds the proficiency bonus with Alert", () => {
    const level3 = calculateSheet(
      makeCharacter({ backgroundId: "criminal" }),
      index,
    );
    const level5 = calculateSheet(
      makeCharacter({
        backgroundId: "criminal",
        classes: [{ classId: "fighter", level: 5 }],
      }),
      index,
    );
    expect(level3.initiative).toBe(4);
    expect(level5.initiative).toBe(5);
  });

  it("applies initiative effects", () => {
    const sheet = calculateSheet(
      makeCharacter({
        activePackageIds: ["srd-2024", "my-homebrew"],
        inventory: equipped("adventurer-charm"),
      }),
      index,
    );
    expect(sheet.initiative).toBe(3);
  });
});

describe("calculateSheet: hit points", () => {
  // SRD 5.2.1, "Puntos de golpe en el nivel 1 por clase": guerrero 10 + Con.
  // Enano, "Aguante enano": +1 por nivel. Brunhilda tiene Con 13 (+1).
  it("uses the full hit die + Con at level 1", () => {
    const sheet = calculateSheet(
      makeCharacter({ classes: [{ classId: "fighter", level: 1 }] }),
      index,
    );
    expect(sheet.hitPoints.max).toBe(10 + 1 + 1);
  });

  // SRD 5.2.1, "Subir de nivel", paso 2, tabla "Puntos de golpe establecidos
  // por clase": guerrero 6 + Con por cada nivel después del 1.
  it("adds the fixed value + Con for each later level", () => {
    const sheet = calculateSheet(makeCharacter(), index);
    // Nivel 1: 10 + 1 · niveles 2 y 3: (6 + 1) × 2 · Aguante enano: +3.
    expect(sheet.hitPoints.max).toBe(11 + 14 + 3);
  });

  // SRD 5.2.1, "Subir de nivel", paso 2: "añade el total (mínimo de 1)".
  it("gains at least 1 HP per level with a low Constitution", () => {
    const sheet = calculateSheet(
      makeCharacter({
        classes: [{ classId: "wizard", level: 3 }],
        baseAbilityScores: { con: 3 },
      }),
      index,
    );
    // Nivel 1: 6 − 4 · niveles 2 y 3: 4 − 4 = 0 → 1 cada uno · Aguante enano: +3.
    expect(sheet.hitPoints.max).toBe(2 + 1 + 1 + 3);
  });

  // SRD 5.2.1, "Ajustar los modificadores por característica": si el
  // modificador por Constitución sube 1, los PG máximos suben 1 por nivel.
  it("recalculates every level when Constitution changes", () => {
    const sheet = calculateSheet(
      makeCharacter({
        choices: [
          {
            kind: "ability-bonus",
            contentId: "soldier",
            level: 1,
            bonuses: { con: 2, str: 1 },
          },
        ],
      }),
      index,
    );
    // Con 15 (+2): 10 + 2 + (6 + 2) × 2 + 3.
    expect(sheet.hitPoints.max).toBe(12 + 16 + 3);
  });

  // SRD 5.2.1, "Multiclase", "Puntos de golpe y dados de golpe": solo obtenés
  // los PG del nivel 1 de una clase cuando tu nivel total es 1, así que la
  // clase inicial (la primera) es la que da el dado entero.
  it("only gives level 1 HP for the starting class", () => {
    const fighterFirst = calculateSheet(
      makeCharacter({
        classes: [
          { classId: "fighter", level: 2 },
          { classId: "wizard", level: 1 },
        ],
      }),
      index,
    );
    const wizardFirst = calculateSheet(
      makeCharacter({
        classes: [
          { classId: "wizard", level: 1 },
          { classId: "fighter", level: 2 },
        ],
      }),
      index,
    );
    // 10 + 1 · 6 + 1 · 4 + 1 · Aguante enano +3.
    expect(fighterFirst.hitPoints.max).toBe(11 + 7 + 5 + 3);
    // 6 + 1 · (6 + 1) × 2 · Aguante enano +3.
    expect(wizardFirst.hitPoints.max).toBe(7 + 14 + 3);
  });

  it("applies hp.max effects", () => {
    const sheet = calculateSheet(
      makeCharacter({
        activePackageIds: ["srd-2024", "my-homebrew"],
        inventory: equipped("adventurer-charm"),
      }),
      index,
    );
    expect(sheet.hitPoints.max).toBe(28 + 5);
  });

  // Se guarda el daño recibido, no los PG actuales (ver characterSchema).
  // SRD 5.2.1, "Puntos de golpe": los PG no bajan de 0.
  it("derives current HP from damage taken, without going below 0", () => {
    const hurt = calculateSheet(
      makeCharacter({
        playState: { damageTaken: 10, tempHp: 4, hitDiceSpent: {} },
      }),
      index,
    );
    const down = calculateSheet(
      makeCharacter({
        playState: { damageTaken: 99, tempHp: 0, hitDiceSpent: {} },
      }),
      index,
    );
    expect(hurt.hitPoints).toEqual({ max: 28, current: 18, temp: 4 });
    expect(down.hitPoints.current).toBe(0);
  });

  // SRD 5.2.1, "Multiclase": tu total de dados de golpe es la suma de los de
  // todas tus clases; si son de distinto tipo, se cuentan por separado.
  it("counts hit dice by type", () => {
    const sheet = calculateSheet(
      makeCharacter({
        classes: [
          { classId: "fighter", level: 2 },
          { classId: "wizard", level: 1 },
        ],
        playState: { damageTaken: 0, tempHp: 0, hitDiceSpent: { d6: 1 } },
      }),
      index,
    );
    expect(sheet.hitDice).toEqual({
      byDie: {
        d10: { total: 2, remaining: 2 },
        d6: { total: 1, remaining: 0 },
      },
      total: 3,
      remaining: 2,
    });
  });

  // Datos viejos o editados a mano: gastar más de los que hay no da negativos.
  it("never shows negative remaining hit dice", () => {
    const sheet = calculateSheet(
      makeCharacter({
        playState: { damageTaken: 0, tempHp: 0, hitDiceSpent: { d10: 9 } },
      }),
      index,
    );
    expect(sheet.hitDice.byDie.d10).toEqual({ total: 3, remaining: 0 });
    expect(sheet.hitDice.remaining).toBe(0);
  });
});

describe("calculateSheet: speed", () => {
  // SRD 5.2.1, enano: velocidad 9 m. En los datos va en pies (30), como en
  // el resto del contenido importado.
  it("uses the species speed", () => {
    expect(calculateSheet(makeCharacter(), index).speed).toBe(30);
  });

  it("applies speed effects", () => {
    const sheet = calculateSheet(
      makeCharacter({
        activePackageIds: ["srd-2024", "my-homebrew"],
        inventory: equipped("adventurer-charm"),
      }),
      index,
    );
    expect(sheet.speed).toBe(40);
  });
  // SRD 5.2.1, "Armaduras", "Fuerza": si la armadura pide una Fuerza y la
  // tuya es menor, tu velocidad baja 3 m (10 pies). Cota de malla: Fuerza 13.
  describe("armor with a Strength requirement", () => {
    it("reduces speed by 10 ft with too little Strength", () => {
      const sheet = calculateSheet(
        makeCharacter({
          baseAbilityScores: { str: 12 },
          inventory: equipped("chain-mail"),
        }),
        index,
      );
      expect(sheet.speed).toBe(20);
      expect(sheet.armorPenalties.insufficientStrength).toBe(true);
    });

    it("does not reduce speed when Strength meets the requirement", () => {
      const sheet = calculateSheet(
        makeCharacter({
          baseAbilityScores: { str: 13 },
          inventory: equipped("chain-mail"),
        }),
        index,
      );
      expect(sheet.speed).toBe(30);
      expect(sheet.armorPenalties.insufficientStrength).toBe(false);
    });

    // Se usa la Fuerza final, con los aumentos del trasfondo.
    it("uses the final Strength score", () => {
      const sheet = calculateSheet(
        makeCharacter({
          baseAbilityScores: { str: 12 },
          choices: [
            {
              kind: "ability-bonus",
              contentId: "soldier",
              level: 1,
              bonuses: { str: 1, dex: 1, con: 1 },
            },
          ],
          inventory: equipped("chain-mail"),
        }),
        index,
      );
      expect(sheet.speed).toBe(30);
    });

    it("does not reduce speed for carried armor", () => {
      const sheet = calculateSheet(
        makeCharacter({
          baseAbilityScores: { str: 8 },
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
      expect(sheet.speed).toBe(30);
    });
  });
});

describe("calculateSheet: darkvision", () => {
  // SRD 5.2.1, enano: "Tienes visión en la oscuridad hasta 36 m" (120 pies).
  // Va como "base": con "max" (un techo) el resultado sería 0.
  it("uses the species darkvision", () => {
    expect(calculateSheet(makeCharacter(), index).darkvision).toBe(120);
  });

  it("adds darkvision effects on top of the base", () => {
    const sheet = calculateSheet(
      makeCharacter({
        activePackageIds: ["srd-2024", "my-homebrew"],
        inventory: equipped("owl-eyes"),
      }),
      index,
    );
    expect(sheet.darkvision).toBe(150);
  });
});

describe("calculateSheet: spellcasting", () => {
  it("is empty for a class without Spellcasting", () => {
    expect(calculateSheet(makeCharacter(), index).spellcasting).toEqual([]);
  });

  // SRD 5.2.1, "Rellena los números", "Lanzamiento de conjuros":
  // CD de salvación = 8 + modificador por aptitud mágica + competencia.
  // Bonificador de ataque = modificador por aptitud mágica + competencia.
  it("calculates save DC and attack bonus", () => {
    const sheet = calculateSheet(
      makeCharacter({
        classes: [{ classId: "wizard", level: 3 }],
        baseAbilityScores: { int: 16 },
      }),
      index,
    );
    expect(sheet.spellcasting).toEqual([
      {
        classId: "wizard",
        ability: "int",
        saveDc: 13,
        attackBonus: 5,
        canCast: true,
      },
    ]);
  });

  // SRD 5.2.1, "Multiclase", "Lanzamiento de conjuros": cada conjuro preparado
  // usa la aptitud mágica de su clase, así que hay una CD por clase.
  it("keeps one entry per spellcasting class when multiclassing", () => {
    const sheet = calculateSheet(
      makeCharacter({
        classes: [
          { classId: "wizard", level: 3 },
          { classId: "cleric", level: 2 },
        ],
        baseAbilityScores: { int: 16, wis: 14 },
      }),
      index,
    );
    // Nivel total 5 → competencia +3.
    expect(sheet.spellcasting).toEqual([
      {
        classId: "wizard",
        ability: "int",
        saveDc: 14,
        attackBonus: 6,
        canCast: true,
      },
      {
        classId: "cleric",
        ability: "wis",
        saveDc: 13,
        attackBonus: 5,
        canCast: true,
      },
    ]);
  });

  it("applies spell.dc and spell.attack effects", () => {
    const sheet = calculateSheet(
      makeCharacter({
        classes: [{ classId: "wizard", level: 3 }],
        baseAbilityScores: { int: 16 },
        activePackageIds: ["srd-2024", "my-homebrew"],
        inventory: equipped("adventurer-charm"),
      }),
      index,
    );
    expect(sheet.spellcasting[0]).toMatchObject({ saveDc: 14, attackBonus: 6 });
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
