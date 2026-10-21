// Personaje de ejemplo para la hoja de demostración (/sheet/example), hasta
// que haya base de datos. Solo guarda elecciones, como cualquier personaje.

import { characterSchema } from "@/rules-engine/schemas";

// Brunhilda: guerrera enana soldado de nivel 3. El trasfondo Soldado le da
// +2 Fue y +1 Con. Lleva cota de malla y escudo, y recibió 9 de daño.
export const sampleCharacter = characterSchema.parse({
  id: "sample-brunhilda",
  name: "Brunhilda Yunquerroca",
  edition: "2024",
  activePackageIds: ["srd-2024"],
  classes: [{ classId: "fighter", level: 3 }],
  speciesId: "dwarf",
  backgroundId: "soldier",
  baseAbilityScores: { str: 14, dex: 12, con: 13, int: 10, wis: 13, cha: 8 },
  choices: [
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
  ],
  inventory: [
    { itemId: "chain-mail", equipped: true },
    { itemId: "shield-item", equipped: true },
  ],
  playState: { damageTaken: 9, tempHp: 0, hitDiceSpent: {} },
});
