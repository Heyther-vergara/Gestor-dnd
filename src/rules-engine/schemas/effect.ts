import { z } from "zod";

import { abilitySchema } from "./common";

// Ruta del valor afectado: "ac", "speed", "proficiency.skill.stealth"…
const targetSchema = z
  .string()
  .regex(
    /^[a-z][a-z0-9]*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
    "Debe ser una ruta en minúsculas separada por puntos",
  );

// Condición libre por ahora ("unarmored", "wielding-shield"…); el motor la interpreta en la fase 2.
const conditionSchema = z.string().min(1).optional();

// Operaciones numéricas, en el orden en que el motor las aplica.
// "base" propone un valor base; si hay varios (armadura, Defensa sin armadura), el motor usa el mayor.
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
    target: targetSchema,
    op: z.enum(numericOps),
    value: z.number(),
    abilities: z.array(abilitySchema).min(1).optional(),
    maxAbilityBonus: z.int().min(0).optional(),
    condition: conditionSchema,
  })
  .refine(
    (effect) => effect.maxAbilityBonus === undefined || effect.abilities,
    {
      message: "maxAbilityBonus requiere abilities",
      path: ["maxAbilityBonus"],
    },
  );

// "grant" concede algo sin valor numérico (una competencia, un sentido, un rasgo).
const grantEffectSchema = z.strictObject({
  target: targetSchema,
  op: z.literal("grant"),
  condition: conditionSchema,
});

export const effectSchema = z.discriminatedUnion("op", [
  numericEffectSchema,
  grantEffectSchema,
]);

export type Effect = z.infer<typeof effectSchema>;
