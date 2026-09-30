import { z } from "zod";

import { abilitySchema, skillSchema, slugSchema } from "./common";
import { effectSchema } from "./effect";

const effectsSchema = z.array(effectSchema).default([]);

// Rasgo con nombre: rasgos de especie, rasgos de clase por nivel, etc.
const traitSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string(),
  effects: effectsSchema,
});

const levelFeatureSchema = traitSchema.extend({
  level: z.int().min(1).max(20),
});

// --- Datos específicos de cada tipo de contenido ---

const classDataSchema = z.strictObject({
  hitDie: z.union([z.literal(6), z.literal(8), z.literal(10), z.literal(12)]),
  // Basta con una: el guerrero ["str", "dex"] es "Fuerza o Destreza".
  primaryAbilities: z.array(abilitySchema).min(1),
  savingThrows: z.array(abilitySchema).length(2),
  skillChoices: z.strictObject({
    count: z.int().min(1),
    options: z.array(skillSchema).min(1),
  }),
  armorProficiencies: z.array(z.string()),
  weaponProficiencies: z.array(z.string()),
  spellcasting: z
    .strictObject({
      ability: abilitySchema,
      preparation: z.enum(["prepared", "known"]),
    })
    .optional(),
  features: z.array(levelFeatureSchema),
});

const subclassDataSchema = z.strictObject({
  classId: slugSchema,
  features: z.array(levelFeatureSchema),
});

const speciesDataSchema = z.strictObject({
  // Algunas especies 2024 permiten elegir tamaño (p. ej. humano: mediano o pequeño).
  size: z.array(z.enum(["tiny", "small", "medium", "large"])).min(1),
  speed: z.int().min(0),
  traits: z.array(traitSchema),
});

// Trasfondo 2024: da +2/+1 (o +1/+1/+1) entre tres atributos, una dote de origen y competencias.
const backgroundDataSchema = z.strictObject({
  abilityOptions: z.array(abilitySchema).length(3),
  featId: slugSchema,
  skillProficiencies: z.array(skillSchema).length(2),
  toolProficiency: z.string().min(1),
  equipment: z.string(),
});

const featDataSchema = z.strictObject({
  category: z.enum(["origin", "general", "fighting-style", "epic-boon"]),
  prerequisite: z.string().optional(),
  repeatable: z.boolean().default(false),
});

const spellDataSchema = z.strictObject({
  level: z.int().min(0).max(9), // 0 = truco
  school: z.enum([
    "abjuration",
    "conjuration",
    "divination",
    "enchantment",
    "evocation",
    "illusion",
    "necromancy",
    "transmutation",
  ]),
  castingTime: z.string().min(1),
  range: z.string().min(1),
  components: z.strictObject({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: z.string().optional(), // descripción del componente material
  }),
  duration: z.string().min(1),
  concentration: z.boolean(),
  ritual: z.boolean(),
  classIds: z.array(slugSchema).min(1),
});

const itemDataSchema = z.strictObject({
  category: z.enum(["weapon", "armor", "shield", "gear", "tool", "magic"]),
  weight: z.number().min(0).optional(), // libras
  cost: z
    .strictObject({
      amount: z.number().min(0),
      unit: z.enum(["cp", "sp", "ep", "gp", "pp"]),
    })
    .optional(),
  requiresAttunement: z.boolean().default(false),
  armor: z
    .strictObject({
      armorCategory: z.enum(["light", "medium", "heavy"]),
      baseAc: z.int().min(0),
      dexCap: z.int().min(0).nullable(), // null = sin límite (armadura ligera)
      strengthRequirement: z.int().min(0).optional(),
      stealthDisadvantage: z.boolean(),
    })
    .optional(),
});

// --- Contenido: campos comunes + `type` que decide el esquema de `data` ---

const contentBase = {
  id: slugSchema,
  packageId: slugSchema,
  name: z.string().min(1),
  description: z.string(),
  effects: effectsSchema,
};

export const contentSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...contentBase,
    type: z.literal("class"),
    data: classDataSchema,
  }),
  z.strictObject({
    ...contentBase,
    type: z.literal("subclass"),
    data: subclassDataSchema,
  }),
  z.strictObject({
    ...contentBase,
    type: z.literal("species"),
    data: speciesDataSchema,
  }),
  z.strictObject({
    ...contentBase,
    type: z.literal("background"),
    data: backgroundDataSchema,
  }),
  z.strictObject({
    ...contentBase,
    type: z.literal("feat"),
    data: featDataSchema,
  }),
  z.strictObject({
    ...contentBase,
    type: z.literal("spell"),
    data: spellDataSchema,
  }),
  z.strictObject({
    ...contentBase,
    type: z.literal("item"),
    data: itemDataSchema,
  }),
]);

export type Content = z.infer<typeof contentSchema>;
export type ContentType = Content["type"];
