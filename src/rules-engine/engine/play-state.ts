// Acciones de partida: daño, curación, PG temporales, descansos y
// salvaciones contra muerte (ADR 0009 y 0010).
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
  | "instant-death"
  | "death-from-failures"; // el fallo por daño con 0 PG fue el tercero

// Qué pasó con una tirada de salvación contra muerte.
export type DeathSaveOutcome =
  "success" | "failure" | "stabilized" | "died" | "regained-hp";

const HIT_DIE_FACES: Record<HitDie, number> = {
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
};

// SRD 5.2.1, "Tres éxitos o fallos": la cuenta termina en tres.
const DEATH_SAVE_LIMIT = 3;
const NO_SAVES = { successes: 0, failures: 0 };

// La muerte se guarda: ninguna acción de este archivo la revierte. Revivir
// necesita magia (por ejemplo, alzar a los muertos), que no está modelada.
const DEAD = "El personaje está muerto";

// SRD 5.2.1: "La cantidad de ambos vuelve a cero si recuperas puntos de golpe
// o te estabilizas". Recuperar PG también termina la estabilidad, porque ya
// no estás en 0.
const backToLife = (playState: PlayState): PlayState => ({
  ...playState,
  deathSaves: NO_SAVES,
  stable: false,
});

// Suma fallos sin pasar de tres; con el tercero, el personaje muere.
const addFailures = (playState: PlayState, count: number): PlayState => {
  const failures = Math.min(
    DEATH_SAVE_LIMIT,
    playState.deathSaves.failures + count,
  );
  return {
    ...playState,
    deathSaves: { ...playState.deathSaves, failures },
    dead: failures >= DEATH_SAVE_LIMIT,
  };
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
  // `critical`: el daño viene de un golpe crítico. Solo importa con 0 PG.
  { critical = false }: { critical?: boolean } = {},
): PlayResult<{ tempHpLost: number; hpLost: number; outcome: DamageOutcome }> {
  if (character.playState.dead) return { ok: false, reason: DEAD };
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
  // con 0 PG, recibir daño cuenta como un fallo de salvación contra muerte
  // (dos si es crítico), y si es mayor o igual a tus PG máximos, morís.
  let playState: PlayState = {
    ...withCurrentHp(character.playState, max, newCurrent),
    tempHp: temp - tempHpLost,
  };
  let outcome: DamageOutcome;
  if (remaining === 0) {
    // Los PG temporales evitan la pérdida de PG reales: no hay fallo.
    outcome = "unharmed";
  } else if (newCurrent > 0) {
    outcome = "hurt";
  } else if (leftover >= max) {
    outcome = "instant-death";
    playState = { ...playState, dead: true };
  } else if (current > 0) {
    // Recién cae: empieza a hacer salvaciones desde cero.
    outcome = "dropped-to-zero";
    playState = backToLife(playState);
  } else {
    // "Estabilizar a un personaje": si una criatura estable sufre daño, deja
    // de estar estable.
    playState = addFailures({ ...playState, stable: false }, critical ? 2 : 1);
    outcome = playState.dead ? "death-from-failures" : "damaged-at-zero";
  }

  return { ok: true, playState, tempHpLost, hpLost, outcome };
}

export function heal(
  character: Character,
  contentIndex: ContentIndex,
  amount: number,
): PlayResult<{ healed: number }> {
  if (character.playState.dead) return { ok: false, reason: DEAD };
  const invalid = invalidAmount(amount);
  if (invalid) return { ok: false, reason: invalid };

  const { current, max } = calculateSheet(character, contentIndex).hitPoints;
  // SRD 5.2.1, "Curación": tus PG no pueden superar tus PG máximos; lo que
  // sobra se pierde.
  const newCurrent = Math.min(max, current + amount);
  const playState = withCurrentHp(character.playState, max, newCurrent);
  return {
    ok: true,
    playState: newCurrent > 0 ? backToLife(playState) : playState,
    healed: newCurrent - current,
  };
}

export function gainTempHp(
  character: Character,
  amount: number,
): PlayResult<{ kept: "new" | "current" }> {
  if (character.playState.dead) return { ok: false, reason: DEAD };
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
  if (character.playState.dead) return { ok: false, reason: DEAD };
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
  if (character.playState.dead) return { ok: false, reason: DEAD };
  const { current } = calculateSheet(character, contentIndex).hitPoints;
  if (current < 1) return { ok: false, reason: CANNOT_REST };
  return {
    ok: true,
    playState: {
      damageTaken: 0,
      tempHp: 0,
      hitDiceSpent: {},
      deathSaves: NO_SAVES,
      stable: false,
      dead: false,
    },
  };
}

// Solo se hacen salvaciones o se estabiliza con 0 PG, sin estar estable ni
// muerto. Devuelve el motivo si no se puede, o los PG máximos si se puede.
function checkDying(
  character: Character,
  contentIndex: ContentIndex,
  messages: { conscious: string; stable: string },
): { ok: false; reason: string } | { ok: true; max: number } {
  if (character.playState.dead) return { ok: false, reason: DEAD };
  const { current, max } = calculateSheet(character, contentIndex).hitPoints;
  if (current > 0) return { ok: false, reason: messages.conscious };
  if (character.playState.stable) {
    return { ok: false, reason: messages.stable };
  }
  return { ok: true, max };
}

// SRD 5.2.1, "Tiradas de salvación contra muerte": al empezar tu turno con
// 0 PG tirás 1d20. El jugador tira en la mesa y carga el resultado.
export function rollDeathSave(
  character: Character,
  contentIndex: ContentIndex,
  roll: number,
): PlayResult<{ outcome: DeathSaveOutcome }> {
  const dying = checkDying(character, contentIndex, {
    conscious: "Solo se hacen salvaciones contra muerte con 0 PG",
    // "Una criatura estable no tendrá que hacer tiradas de salvación".
    stable: "El personaje está estable: no hace salvaciones",
  });
  if (!dying.ok) return dying;
  if (!Number.isInteger(roll) || roll < 1 || roll > 20) {
    return { ok: false, reason: "La tirada de un d20 va de 1 a 20" };
  }

  const { playState } = character;
  // "Sacar 1 o 20": con un 20 recuperás 1 PG, y al recuperar PG las cuentas
  // vuelven a cero.
  if (roll === 20) {
    return {
      ok: true,
      playState: backToLife(withCurrentHp(playState, dying.max, 1)),
      outcome: "regained-hp",
    };
  }
  // Con un 1, dos fallos. "Tres éxitos o fallos": 10 o más es éxito.
  if (roll < 10) {
    const next = addFailures(playState, roll === 1 ? 2 : 1);
    return {
      ok: true,
      playState: next,
      outcome: next.dead ? "died" : "failure",
    };
  }
  const successes = playState.deathSaves.successes + 1;
  // "En tu tercer éxito te estabilizarás", y estabilizarte pone la cuenta
  // en cero.
  if (successes >= DEATH_SAVE_LIMIT) {
    return {
      ok: true,
      playState: { ...playState, deathSaves: NO_SAVES, stable: true },
      outcome: "stabilized",
    };
  }
  return {
    ok: true,
    playState: {
      ...playState,
      deathSaves: { ...playState.deathSaves, successes },
    },
    outcome: "success",
  };
}

// SRD 5.2.1, "Estabilizar a un personaje": otro personaje usa la acción de
// ayudar y supera una prueba de Sabiduría (Medicina) CD 10. La prueba se tira
// en la mesa; esto registra que salió bien. El personaje sigue con 0 PG.
export function stabilize(
  character: Character,
  contentIndex: ContentIndex,
): PlayResult {
  const dying = checkDying(character, contentIndex, {
    conscious: "Solo se puede estabilizar a alguien con 0 PG",
    stable: "El personaje ya está estable",
  });
  if (!dying.ok) return dying;
  return {
    ok: true,
    playState: { ...character.playState, deathSaves: NO_SAVES, stable: true },
  };
}
