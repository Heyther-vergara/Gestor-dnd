import { z } from "zod";

import { abilitySchema, skillSchema } from "./common";

// --- Vocabulario cerrado de `target` (ADR 0003) ---
// Antes era texto libre: un typo como "acc" pasaba la validación y el motor lo
// ignoraba sin avisar. Ahora solo valen estas rutas; agregar una nueva es
// sumarla acá y enseñarle al motor a calcularla.

// Valores numéricos que calcula el motor.
export const numericTargetSchema = z.union([
  z.enum([
    "ac",
    "initiative",
    "speed",
    "hp.max",
    "hp.max-per-level",
    "senses.darkvision",
    "spell.attack",
    "spell.dc",
  ]),
  z.templateLiteral(["ability.", abilitySchema]), // puntuación: "ability.str"
  z.templateLiteral(["save.", abilitySchema]), // bonificador extra: "save.dex"
  z.templateLiteral(["skill.", skillSchema]), // bonificador extra: "skill.stealth"
]);

// Cosas que se conceden sin número (competencias).
export const grantTargetSchema = z.union([
  z.templateLiteral(["proficiency.skill.", skillSchema]),
  z.templateLiteral(["proficiency.save.", abilitySchema]),
  z.templateLiteral([
    "proficiency.armor.",
    z.enum(["light", "medium", "heavy", "shield"]),
  ]),
  z.templateLiteral(["proficiency.weapon.", z.enum(["simple", "martial"])]),
  // SRD 5.2.1, dote "Alerta": sumás tu bonificador por competencia a la
  // iniciativa. Va como concesión y no como número fijo para que suba con el nivel.
  z.literal("proficiency.initiative"),
]);

// --- Condiciones: cuándo aplica un efecto ---
// SRD 5.2.1 "Defensa sin armadura" (bárbaro): "mientras no lleves armadura alguna…
// aunque lleves un escudo" → "unarmored".
// SRD 5.2.1 "Defensa sin armadura" (monje): "mientras no lleves armadura ni portes
// un escudo" → "unarmored-no-shield".
export const conditionSchema = z.enum(["unarmored", "unarmored-no-shield"]);

// Operaciones numéricas, en el orden en que el motor las aplica.
// "base" propone un valor base; si hay varios (armadura, Defensa sin armadura), el motor usa el mayor.
// "min" es un piso ("tu CA no puede ser menor que 16") y "max" un techo. Detalle en engine/effects.ts.
export const numericOps = [
  "base",
  "set",
  "add",
  "multiply",
  "min",
  "max",
] as const;

// Valor final = value + suma de los modificadores de `abilities`, con tope opcional `maxAbilityBonus`.
// SRD 5.2.1 "Armaduras": cota de malla 16 · armadura de cuero 11 + Des · media 14 + Des (máx. 2).
const numericEffectSchema = z
  .strictObject({
    target: numericTargetSchema,
    op: z.enum(numericOps),
    value: z.number(),
    abilities: z.array(abilitySchema).min(1).optional(),
    maxAbilityBonus: z.int().min(0).optional(),
    condition: conditionSchema.optional(),
  })
  .refine(
    (effect) => effect.maxAbilityBonus === undefined || effect.abilities,
    {
      message: "maxAbilityBonus requiere abilities",
      path: ["maxAbilityBonus"],
    },
  );

// "grant" concede algo sin valor numérico (una competencia).
const grantEffectSchema = z.strictObject({
  target: grantTargetSchema,
  op: z.literal("grant"),
  condition: conditionSchema.optional(),
});

export const effectSchema = z.discriminatedUnion("op", [
  numericEffectSchema,
  grantEffectSchema,
]);

export type NumericTarget = z.infer<typeof numericTargetSchema>;
export type GrantTarget = z.infer<typeof grantTargetSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type Effect = z.infer<typeof effectSchema>;
