import { describe, expect, it } from "vitest";

import backgrounds from "@/content/srd-2024/backgrounds.json";
import classes from "@/content/srd-2024/classes.json";
import feats from "@/content/srd-2024/feats.json";
import species from "@/content/srd-2024/species.json";
import spells from "@/content/srd-2024/spells.json";
import { calculateSheet, createContentIndex } from "@/rules-engine/engine";
import { characterSchema, contentSchema } from "@/rules-engine/schemas";

// Personaje de ejemplo armado con el contenido SRD real del paquete, para
// comprobar que el JSON importado y el motor encajan.

const index = createContentIndex(
  [...classes, ...species, ...backgrounds, ...feats, ...spells].map((c) =>
    contentSchema.parse(c),
  ),
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

describe("SRD 2024 sample character: Thora, dwarf wizard 1", () => {
  const sheet = calculateSheet(thora, index);

  it("has no data issues", () => {
    expect(sheet.issues).toEqual([]);
  });

  // SRD 5.2.1, "Puntos de golpe en el nivel 1 por clase": mago 6 + Con (16 → +3).
  // Enano, "Aguante enano": +1.
  it("has 10 hit points", () => {
    expect(sheet.hitPoints.max).toBe(6 + 3 + 1);
    expect(sheet.hitDice.byDie).toEqual({ d6: 1 });
  });

  // SRD 5.2.1, "Rellena los números": iniciativa = mod. de Des; enano 9 m (30 pies).
  it("has initiative +2 and speed 30 ft", () => {
    expect(sheet.initiative).toBe(2);
    expect(sheet.speed).toBe(30);
  });

  // SRD 5.2.1, "Lanzamiento de conjuros": CD 8 + Int (17 → +3) + competencia (+2).
  it("has spell save DC 13 and spell attack +5", () => {
    expect(sheet.spellcasting).toEqual([
      { classId: "wizard", ability: "int", saveDc: 13, attackBonus: 5 },
    ]);
  });
});
