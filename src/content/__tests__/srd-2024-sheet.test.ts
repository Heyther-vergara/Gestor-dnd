import { describe, expect, it } from "vitest";

import backgrounds from "@/content/srd-2024/backgrounds.json";
import classes from "@/content/srd-2024/classes.json";
import feats from "@/content/srd-2024/feats.json";
import items from "@/content/srd-2024/items.json";
import species from "@/content/srd-2024/species.json";
import spells from "@/content/srd-2024/spells.json";
import subclasses from "@/content/srd-2024/subclasses.json";
import { calculateSheet, createContentIndex } from "@/rules-engine/engine";
import { characterSchema, contentSchema } from "@/rules-engine/schemas";

// Personaje de ejemplo armado con el contenido SRD real del paquete, para
// comprobar que el JSON importado y el motor encajan.

const index = createContentIndex(
  [
    ...classes,
    ...subclasses,
    ...species,
    ...backgrounds,
    ...feats,
    ...spells,
    ...items,
  ].map((c) => contentSchema.parse(c)),
);

// Thora: maga enana sabia de nivel 1. El trasfondo Sabio le da +2 Int y +1 Con.
const thora = characterSchema.parse({
  id: "thora",
  name: "Thora",
  edition: "2024",
  activePackageIds: ["srd-2024"],
  classes: [{ classId: "wizard", level: 1 }],
  speciesId: "dwarf",
  backgroundId: "sage",
  baseAbilityScores: { str: 8, dex: 14, con: 15, int: 15, wis: 12, cha: 10 },
  choices: [
    {
      kind: "ability-bonus",
      contentId: "sage",
      level: 1,
      bonuses: { int: 2, con: 1 },
    },
  ],
});

const thoraItem = { quantity: 1, equipped: true, attuned: false };

describe("SRD 2024 sample character: Thora, dwarf wizard 1", () => {
  const sheet = calculateSheet(thora, index);

  it("has no data issues", () => {
    expect(sheet.issues).toEqual([]);
  });

  // SRD 5.2.1, enano, "Visión en la oscuridad": 36 m (120 pies).
  it("has darkvision 120 ft", () => {
    expect(sheet.darkvision).toBe(120);
  });

  // SRD 5.2.1, "Puntos de golpe en el nivel 1 por clase": mago 6 + Con (16 → +3).
  // Enano, "Aguante enano": +1.
  it("has 10 hit points", () => {
    expect(sheet.hitPoints.max).toBe(6 + 3 + 1);
    expect(sheet.hitDice.byDie).toEqual({ d6: { total: 1, remaining: 1 } });
  });

  // SRD 5.2.1, "Rellena los números": iniciativa = mod. de Des; enano 9 m (30 pies).
  it("has initiative +2 and speed 30 ft", () => {
    expect(sheet.initiative).toBe(2);
    expect(sheet.speed).toBe(30);
  });

  // SRD 5.2.1, "Lanzamiento de conjuros": CD 8 + Int (17 → +3) + competencia (+2).
  it("has spell save DC 13 and spell attack +5", () => {
    expect(sheet.spellcasting).toEqual([
      {
        classId: "wizard",
        ability: "int",
        saveDc: 13,
        attackBonus: 5,
        canCast: true,
        // SRD 5.2.1, tabla "Rasgos de mago": 2 espacios de nivel 1.
        slots: [2],
      },
    ]);
  });

  // SRD 5.2.1, "Entrenamiento con armaduras": la maga no tiene entrenamiento,
  // así que con cota de malla no puede lanzar conjuros. "Armaduras", "Fuerza":
  // la cota de malla pide Fuerza 13 y Thora tiene 8, así que pierde 3 m.
  it("cannot cast spells and slows down in chain mail", () => {
    const inChainMail = calculateSheet(
      { ...thora, inventory: [{ ...thoraItem, itemId: "chain-mail" }] },
      index,
    );
    expect(inChainMail.ac).toBe(16);
    expect(inChainMail.armorPenalties).toEqual({
      untrainedArmor: true,
      untrainedShield: false,
      insufficientStrength: true,
    });
    expect(inChainMail.spellcasting[0]?.canCast).toBe(false);
    expect(inChainMail.speed).toBe(20);
  });
});

// Bram: guerrero humano soldado de nivel 1. El trasfondo Soldado le da +2 Fue
// y +1 Con. Destreza 16 (+3) para ver el tope de las armaduras medias.
const bram = (inventory: string[]) =>
  characterSchema.parse({
    id: "bram",
    name: "Bram",
    edition: "2024",
    activePackageIds: ["srd-2024"],
    classes: [{ classId: "fighter", level: 1 }],
    speciesId: "human",
    backgroundId: "soldier",
    baseAbilityScores: { str: 13, dex: 16, con: 14, int: 8, wis: 12, cha: 10 },
    choices: [
      {
        kind: "ability-bonus",
        contentId: "soldier",
        level: 1,
        bonuses: { str: 2, con: 1 },
      },
    ],
    inventory: inventory.map((itemId) => ({ itemId, equipped: true })),
  });

describe("SRD 2024 sample character: Bram, human fighter 1 with real armor", () => {
  it("has no data issues", () => {
    expect(
      calculateSheet(bram(["chain-mail", "shield-item"]), index).issues,
    ).toEqual([]);
  });

  // SRD 5.2.1, "Atributos básicos de guerrero": entrenamiento con todas las
  // armaduras y escudos; Fuerza 15 cumple la de la cota de malla (13).
  it("has no armor penalties in chain mail with a shield", () => {
    const sheet = calculateSheet(bram(["chain-mail", "shield-item"]), index);
    expect(sheet.armorPenalties).toEqual({
      untrainedArmor: false,
      untrainedShield: false,
      insufficientStrength: false,
    });
    expect(sheet.speed).toBe(30);
  });

  // SRD 5.2.1, "Armaduras": cota de malla 16 (sin Des) + escudo +2.
  it("has AC 18 with chain mail and a shield", () => {
    expect(calculateSheet(bram(["chain-mail", "shield-item"]), index).ac).toBe(
      18,
    );
  });

  // SRD 5.2.1, "Armaduras": cota de escamas 14 + Des (máx. 2). Des +3 suma solo 2.
  it("caps Dex at +2 with scale mail", () => {
    expect(calculateSheet(bram(["scale-mail"]), index).ac).toBe(16);
  });

  // SRD 5.2.1, "Armaduras": armadura de cuero 11 + Des, sin tope.
  it("adds the full Dex with leather armor", () => {
    expect(calculateSheet(bram(["leather-armor"]), index).ac).toBe(14);
  });

  // SRD 5.2.1, glosario, "Clase de armadura": sin armadura, 10 + Des.
  it("has AC 13 without armor", () => {
    expect(calculateSheet(bram([]), index).ac).toBe(13);
  });

  // El humano no tiene visión en la oscuridad.
  it("has no darkvision", () => {
    expect(calculateSheet(bram([]), index).darkvision).toBe(0);
  });
});

// Thora en el nivel 5: Evocadora, con la mejora de característica del nivel
// 4 en Inteligencia (+2).
const thora5 = characterSchema.parse({
  ...thora,
  classes: [{ classId: "wizard", level: 5, subclassId: "evoker" }],
  choices: [
    ...thora.choices,
    {
      kind: "ability-score-improvement",
      contentId: "wizard",
      level: 4,
      bonuses: { int: 2 },
    },
  ],
});

describe("SRD 2024 sample character: Thora, dwarf Evoker wizard 5", () => {
  const sheet = calculateSheet(thora5, index);

  it("has no data issues", () => {
    expect(sheet.issues).toEqual([]);
  });

  // SRD 5.2.1, "Subir de nivel", tabla "Puntos de golpe establecidos por
  // clase": mago 4 + Con por nivel después del 1. Nivel 1: 6 + Con (+3).
  // "Aguante enano": +1 por nivel.
  it("has 42 hit points and 5d6 hit dice", () => {
    expect(sheet.hitPoints.max).toBe(6 + 3 + 4 * (4 + 3) + 5);
    expect(sheet.hitDice.byDie).toEqual({ d6: { total: 5, remaining: 5 } });
  });

  // SRD 5.2.1, tabla "Rasgos de mago": competencia +3 en el nivel 5.
  // Inteligencia 15 + 2 (trasfondo) + 2 (mejora) = 19 → +4.
  // CD 8 + 4 + 3 = 15; ataque 4 + 3 = +7. Espacios 4, 3 y 2.
  it("has spell save DC 15, attack +7 and slots 4/3/2", () => {
    expect(sheet.proficiencyBonus).toBe(3);
    expect(sheet.abilities.int.score).toBe(19);
    expect(sheet.spellcasting[0]).toMatchObject({
      saveDc: 15,
      attackBonus: 7,
      slots: [4, 3, 2],
    });
  });

  it("has the Evoker features", () => {
    expect(
      sheet.features.filter((f) => f.sourceId === "evoker").map((f) => f.name),
    ).toEqual(["Evocation Savant", "Potent Cantrip"]);
  });
});

// Bram en el nivel 4: Campeón, con +1 Fue y +1 Con de la mejora.
describe("SRD 2024 sample character: Bram, human Champion fighter 4", () => {
  const sheet = calculateSheet(
    characterSchema.parse({
      ...bram([]),
      classes: [{ classId: "fighter", level: 4, subclassId: "champion" }],
      choices: [
        ...bram([]).choices,
        {
          kind: "ability-score-improvement",
          contentId: "fighter",
          level: 4,
          bonuses: { str: 1, con: 1 },
        },
      ],
    }),
    index,
  );

  it("has no data issues", () => {
    expect(sheet.issues).toEqual([]);
  });

  // Fue 13 + 2 + 1 = 16; Con 14 + 1 + 1 = 16 (+3).
  // Guerrero: 10 + Con en el nivel 1 y 6 + Con en cada nivel siguiente.
  it("has 40 hit points", () => {
    expect(sheet.abilities.str.score).toBe(16);
    expect(sheet.abilities.con.score).toBe(16);
    expect(sheet.hitPoints.max).toBe(10 + 3 + 3 * (6 + 3));
  });

  // Un guerrero no lanza conjuros.
  it("has no spellcasting", () => {
    expect(sheet.spellcasting).toEqual([]);
  });

  it("has the class and Champion features up to level 4", () => {
    expect(sheet.features.map((f) => f.name)).toContain("Improved Critical");
    expect(sheet.features.map((f) => f.name)).not.toContain("Extra Attack");
  });
});
