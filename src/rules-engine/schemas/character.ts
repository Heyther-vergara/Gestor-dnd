import { z } from "zod";

import {
  abilitySchema,
  editionSchema,
  hitDieSchema,
  skillSchema,
  slugSchema,
} from "./common";

// Un personaje guarda solo elecciones y estado. Todo lo derivado (CA, PG máximos,
// bonificadores…) lo calcula calculateSheet() y nunca se almacena.

const abilityScoreSchema = z.int().min(1).max(30);

const abilityScoresSchema = z.strictObject({
  str: abilityScoreSchema,
  dex: abilityScoreSchema,
  con: abilityScoreSchema,
  int: abilityScoreSchema,
  wis: abilityScoreSchema,
  cha: abilityScoreSchema,
});

const classLevelSchema = z.strictObject({
  classId: slugSchema,
  level: z.int().min(1).max(20),
});

// --- Elecciones del jugador, cada una asociada al contenido que la ofrece ---

const choiceBase = {
  contentId: slugSchema, // el contenido que ofrece la elección (clase, trasfondo…)
  level: z.int().min(1).max(20), // nivel de personaje en que se tomó
};

const skillsChoiceSchema = z.strictObject({
  ...choiceBase,
  kind: z.literal("skills"),
  skills: z.array(skillSchema).min(1),
});

// SRD 5.2.1 "Crear un personaje": +2 a una y +1 a otra distinta, o +1 a las tres.
// Que sean las tres del trasfondo y que no pasen de 20 lo comprueba el motor, que conoce el contenido.
// SRD 5.2.1, glosario, "Pericia": duplica el bonificador por competencia en una
// habilidad en la que ya sos competente. Siempre se elige (mago "Erudito",
// pícaro), así que va como elección y no como efecto. Que seas competente en
// la habilidad lo comprueba el motor.
const expertiseChoiceSchema = z.strictObject({
  ...choiceBase,
  kind: z.literal("expertise"),
  skills: z.array(skillSchema).min(1),
});

const abilityBonusChoiceSchema = z.strictObject({
  ...choiceBase,
  kind: z.literal("ability-bonus"),
  bonuses: z.partialRecord(abilitySchema, z.int().min(1).max(2)).refine(
    (bonuses) => {
      const values = Object.values(bonuses).sort();
      const pattern = values.join(",");
      return pattern === "1,2" || pattern === "1,1,1";
    },
    { message: "Debe ser +2/+1 a dos características o +1 a tres" },
  ),
});

const sizeChoiceSchema = z.strictObject({
  ...choiceBase,
  kind: z.literal("size"),
  size: z.enum(["tiny", "small", "medium", "large"]),
});

export const choiceSchema = z.discriminatedUnion("kind", [
  skillsChoiceSchema,
  expertiseChoiceSchema,
  abilityBonusChoiceSchema,
  sizeChoiceSchema,
]);

const inventoryItemSchema = z.strictObject({
  itemId: slugSchema,
  quantity: z.int().min(1).default(1),
  equipped: z.boolean().default(false),
  attuned: z.boolean().default(false),
});

// Se guarda el daño recibido, no los PG actuales: si los PG máximos cambian
// (subir de nivel, un objeto), los PG actuales se recalculan solos.
// Los dados de golpe gastados van por tipo ({ d10: 1 }): con multiclase
// importa de qué clase era el dado (ADR 0009).
const playStateSchema = z.strictObject({
  damageTaken: z.int().min(0).default(0),
  tempHp: z.int().min(0).default(0),
  hitDiceSpent: z.partialRecord(hitDieSchema, z.int().min(0)).default({}),
  // Salvaciones contra muerte con 0 PG. Tres de un tipo terminan la cuenta:
  // con tres éxitos quedás estable y con tres fallos morís (ADR 0010).
  deathSaves: z
    .strictObject({
      successes: z.int().min(0).max(3),
      failures: z.int().min(0).max(3),
    })
    .default({ successes: 0, failures: 0 }),
  // Estable con 0 PG: no hace salvaciones contra muerte.
  stable: z.boolean().default(false),
  // Se guarda porque la muerte no se deduce de los PG: con 0 PG podés estar
  // agonizando, estable o muerto.
  dead: z.boolean().default(false),
  // Cuánto se redujeron los PG máximos (por ejemplo, por daño necrótico que
  // "absorbe la energía vital"). Es estado, no un valor derivado: lo causa un
  // efecto de la partida y se quita con un descanso largo (ADR 0012).
  maxHpReduction: z.int().min(0).default(0),
});

export const characterSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  edition: editionSchema,
  activePackageIds: z.array(slugSchema).min(1),
  classes: z.array(classLevelSchema).min(1),
  speciesId: slugSchema,
  backgroundId: slugSchema,
  baseAbilityScores: abilityScoresSchema,
  choices: z.array(choiceSchema).default([]),
  inventory: z.array(inventoryItemSchema).default([]),
  playState: playStateSchema.default({
    damageTaken: 0,
    tempHp: 0,
    hitDiceSpent: {},
    deathSaves: { successes: 0, failures: 0 },
    stable: false,
    dead: false,
    maxHpReduction: 0,
  }),
});

export type AbilityScores = z.infer<typeof abilityScoresSchema>;
export type Choice = z.infer<typeof choiceSchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type Character = z.infer<typeof characterSchema>;
// Lo que se puede pasar a `characterSchema.parse`: los campos con valor por
// defecto son opcionales (por ejemplo, las salvaciones contra muerte).
export type CharacterInput = z.input<typeof characterSchema>;
export type PlayState = Character["playState"];
