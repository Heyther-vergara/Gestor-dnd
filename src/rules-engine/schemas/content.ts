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

// SRD 5.2.1, "Equipo", "Armas". Daño en dados ("1d8", "2d6") o fijo ("1",
// cerbatana). Alcances en pies, como el resto del contenido importado.
const diceSchema = z
  .string()
  .regex(/^\d+(?:d\d+)?$/, 'Debe ser "XdY" o un número fijo');

export const damageTypeSchema = z.enum([
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
]);

const weaponDataSchema = z.strictObject({
  weaponCategory: z.enum(["simple", "martial"]),
  attackType: z.enum(["melee", "ranged"]),
  damage: z.strictObject({ dice: diceSchema, type: damageTypeSchema }),
  // Propiedad "Versátil": daño al usarla con las dos manos.
  versatileDice: diceSchema.optional(),
  properties: z.array(
    z.enum([
      "ammunition",
      "finesse",
      "heavy",
      "light",
      "loading",
      "reach",
      "thrown",
      "two-handed",
      "versatile",
    ]),
  ),
  // "Propiedades de maestría": Debilitar (sap), Derribar (topple), Empujar
  // (push), Hender (cleave), Mellar (nick), Molestar (vex), Ralentizar (slow),
  // Rozar (graze).
  mastery: z.enum([
    "cleave",
    "graze",
    "nick",
    "push",
    "sap",
    "slow",
    "topple",
    "vex",
  ]),
  // Alcance normal/largo de las armas a distancia y arrojadizas.
  range: z
    .strictObject({ normal: z.int().min(0), long: z.int().min(0) })
    .optional(),
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
  // La CA de la armadura NO va acá: va en `effects` como { target: "ac", op: "base" }
  // (ADR 0003). Acá queda solo lo que no es CA.
  armor: z
    .strictObject({
      armorCategory: z.enum(["light", "medium", "heavy"]),
      strengthRequirement: z.int().min(0).optional(),
      stealthDisadvantage: z.boolean(),
    })
    .optional(),
  weapon: weaponDataSchema.optional(),
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
  z
    .strictObject({
      ...contentBase,
      type: z.literal("item"),
      data: itemDataSchema,
    })
    // Un arma necesita sus datos de arma. Un objeto mágico (p. ej. un arma +1)
    // también puede llevarlos, por eso no se exige al revés.
    .refine(
      (item) =>
        item.data.category !== "weapon" || item.data.weapon !== undefined,
      { message: "Un arma necesita data.weapon", path: ["data", "weapon"] },
    )
    .refine(
      (item) =>
        item.data.category !== "armor" ||
        (item.data.armor !== undefined &&
          item.effects.filter((e) => e.target === "ac" && e.op === "base")
            .length === 1),
      {
        message:
          'Una armadura necesita data.armor y exactamente un efecto { target: "ac", op: "base" }',
        path: ["effects"],
      },
    ),
]);

export type Content = z.infer<typeof contentSchema>;
export type ContentType = Content["type"];
