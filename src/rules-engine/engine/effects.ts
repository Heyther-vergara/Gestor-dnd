import type { Ability, Effect, NumericTarget } from "../schemas";

export type NumericEffect = Exclude<Effect, { op: "grant" }>;

export type Modifiers = Record<Ability, number>;

// Valor de un efecto: `value` + la suma de los modificadores de `abilities`,
// con tope `maxAbilityBonus` si lo hay. El tope solo limita hacia arriba:
// una coraza con Des −1 da 14 − 1 = 13.
export function resolveEffectValue(
  effect: NumericEffect,
  modifiers: Modifiers,
): number {
  if (!effect.abilities) return effect.value;
  const bonus = effect.abilities.reduce((sum, a) => sum + modifiers[a], 0);
  const capped =
    effect.maxAbilityBonus === undefined
      ? bonus
      : Math.min(bonus, effect.maxAbilityBonus);
  return effect.value + capped;
}

// Aplica efectos numéricos sobre un valor en el orden del motor:
// base → set → add → multiply → min → max.
// - base: cada efecto propone una base; se usa la mayor, incluida `implicitBase`
//   (p. ej. 10 + Des para la CA). ADR 0003.
// - set: reemplaza el valor; si hay varios, gana el mayor.
// - add: suma.
// - multiply: multiplica y redondea hacia abajo.
// - min: el valor no puede bajar de X ("tu CA no puede ser menor que 16").
// - max: el valor no puede pasar de X. Si choca con un min, gana el max.
export function applyNumericEffects(
  implicitBase: number,
  effects: readonly NumericEffect[],
  modifiers: Modifiers,
): number {
  const values = (op: NumericEffect["op"]) =>
    effects
      .filter((e) => e.op === op)
      .map((e) => resolveEffectValue(e, modifiers));

  let result = Math.max(implicitBase, ...values("base"));

  const sets = values("set");
  if (sets.length > 0) result = Math.max(...sets);

  result += values("add").reduce((sum, v) => sum + v, 0);

  for (const factor of values("multiply")) {
    result = Math.floor(result * factor);
  }

  const floors = values("min");
  if (floors.length > 0) result = Math.max(result, ...floors);

  const ceilings = values("max");
  if (ceilings.length > 0) result = Math.min(result, ...ceilings);

  return result;
}

export const isNumericEffect = (effect: Effect): effect is NumericEffect =>
  effect.op !== "grant";

// Efectos numéricos de un target concreto.
export const effectsFor = (
  effects: readonly NumericEffect[],
  target: NumericTarget,
) => effects.filter((e) => e.target === target);
