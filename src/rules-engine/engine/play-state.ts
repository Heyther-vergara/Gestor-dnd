// Acciones de partida: daño, curación, PG temporales y descansos.
// Cada una recibe el personaje y devuelve un playState nuevo, sin modificar
// el original. Son puras: el motor no tira dados, recibe el resultado (ADR 0009).

import type { Character, HitDie, PlayState } from "../schemas";
import { type ContentIndex, calculateSheet } from "./index";

// Resultado de una acción: el estado nuevo y lo que pasó, o el motivo por el
// que no se pudo hacer (por ejemplo, descansar con 0 PG).
export type PlayResult<Details extends object = object> =
  | ({ ok: true; playState: PlayState } & Details)
  | { ok: false; reason: string };

// Qué le pasó al personaje con el daño, para que la interfaz lo cuente.
export type DamageOutcome =
  | "unharmed" // todo lo absorbieron los PG temporales (o el daño era 0)
  | "hurt"
  | "dropped-to-zero"
  | "damaged-at-zero"
  | "instant-death";

const HIT_DIE_FACES: Record<HitDie, number> = {
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
};

const invalidAmount = (amount: number): string | undefined =>
  Number.isInteger(amount) && amount >= 0
    ? undefined
    : "La cantidad tiene que ser un número entero desde 0";

// Se guarda el daño recibido; a partir de los PG actuales nuevos se vuelve a
// calcular. Así también se corrige un daño guardado mayor que el máximo.
const withCurrentHp = (
  playState: PlayState,
  max: number,
  current: number,
): PlayState => ({ ...playState, damageTaken: max - current });

export function applyDamage(
  character: Character,
  contentIndex: ContentIndex,
  amount: number,
): PlayResult<{ tempHpLost: number; hpLost: number; outcome: DamageOutcome }> {
  const invalid = invalidAmount(amount);
  if (invalid) return { ok: false, reason: invalid };

  const { current, max, temp } = calculateSheet(
    character,
    contentIndex,
  ).hitPoints;

  // SRD 5.2.1, "Puntos de golpe temporales": se pierden primero y el daño
  // sobrante se aplica a los puntos de golpe normales.
  const tempHpLost = Math.min(temp, amount);
  const remaining = amount - tempHpLost;
  // SRD 5.2.1, "Puntos de golpe": no bajan de 0.
  const hpLost = Math.min(current, remaining);
  const leftover = remaining - hpLost;
  const newCurrent = current - hpLost;

  // SRD 5.2.1, "Daño considerable": si llegás a 0 y el daño que sobra es
  // mayor o igual a tus PG máximos, morís. "Daño con 0 puntos de golpe":
  // con 0 PG, recibir daño cuenta como un fallo de salvación contra muerte,
  // y si es mayor o igual a tus PG máximos, morís.
  let outcome: DamageOutcome;
  if (remaining === 0) outcome = "unharmed";
  else if (newCurrent > 0) outcome = "hurt";
  else if (leftover >= max) outcome = "instant-death";
  else outcome = current === 0 ? "damaged-at-zero" : "dropped-to-zero";

  return {
    ok: true,
    playState: {
      ...withCurrentHp(character.playState, max, newCurrent),
      tempHp: temp - tempHpLost,
    },
    tempHpLost,
    hpLost,
    outcome,
  };
}

export function heal(
  character: Character,
  contentIndex: ContentIndex,
  amount: number,
): PlayResult<{ healed: number }> {
  const invalid = invalidAmount(amount);
  if (invalid) return { ok: false, reason: invalid };

  const { current, max } = calculateSheet(character, contentIndex).hitPoints;
  // SRD 5.2.1, "Curación": tus PG no pueden superar tus PG máximos; lo que
  // sobra se pierde.
  const newCurrent = Math.min(max, current + amount);
  return {
    ok: true,
    playState: withCurrentHp(character.playState, max, newCurrent),
    healed: newCurrent - current,
  };
}

export function gainTempHp(
  character: Character,
  amount: number,
): PlayResult<{ kept: "new" | "current" }> {
  const invalid = invalidAmount(amount);
  if (invalid) return { ok: false, reason: invalid };

  // SRD 5.2.1, "Puntos de golpe temporales": no se suman. Si ya tenés y
  // recibís más, elegís con cuáles te quedás. Se conserva el mayor, que es
  // lo que conviene salvo rasgos muy específicos (ADR 0009).
  const { tempHp } = character.playState;
  const kept = amount > tempHp ? "new" : "current";
  return {
    ok: true,
    playState: { ...character.playState, tempHp: Math.max(tempHp, amount) },
    kept,
  };
}

// SRD 5.2.1, "Descanso corto" y "Descanso largo": para empezar un descanso
// tenés que tener al menos 1 punto de golpe.
const CANNOT_REST = "Para descansar necesitás al menos 1 punto de golpe";

// SRD 5.2.1, "Descanso corto", "Gastar dados de puntos de golpe": por cada
// dado que gastás, lo tirás y sumás tu modificador por Constitución;
// recuperás ese total, con un mínimo de 1. Decidís si gastás otro después de
// cada tirada, por eso se gasta de a uno.
export function spendHitDie(
  character: Character,
  contentIndex: ContentIndex,
  die: HitDie,
  roll: number,
): PlayResult<{ healed: number }> {
  const sheet = calculateSheet(character, contentIndex);
  const { current, max } = sheet.hitPoints;
  if (current < 1) return { ok: false, reason: CANNOT_REST };

  const available = sheet.hitDice.byDie[die]?.remaining ?? 0;
  if (available < 1) {
    return { ok: false, reason: `No te quedan dados de golpe ${die}` };
  }
  const faces = HIT_DIE_FACES[die];
  if (!Number.isInteger(roll) || roll < 1 || roll > faces) {
    return {
      ok: false,
      reason: `La tirada de un ${die} va de 1 a ${faces}`,
    };
  }

  const regained = Math.max(1, roll + sheet.abilities.con.modifier);
  const newCurrent = Math.min(max, current + regained);
  const { hitDiceSpent } = character.playState;
  return {
    ok: true,
    playState: {
      ...withCurrentHp(character.playState, max, newCurrent),
      hitDiceSpent: { ...hitDiceSpent, [die]: (hitDiceSpent[die] ?? 0) + 1 },
    },
    healed: newCurrent - current,
  };
}

// SRD 5.2.1, "Descanso largo": recuperás todos los PG perdidos y todos los
// dados de golpe gastados. "Puntos de golpe temporales": duran hasta que
// finalizás un descanso largo.
export function longRest(
  character: Character,
  contentIndex: ContentIndex,
): PlayResult {
  const { current } = calculateSheet(character, contentIndex).hitPoints;
  if (current < 1) return { ok: false, reason: CANNOT_REST };
  return {
    ok: true,
    playState: { damageTaken: 0, tempHp: 0, hitDiceSpent: {} },
  };
}
