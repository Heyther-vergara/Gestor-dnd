// Reducer de la hoja en partida: traduce cada botón a una acción del motor y
// arma el mensaje que ve el jugador. No conoce reglas: las decide el motor.
// Es una función pura para usarla con useReducer de React y poder testearla.

import { damageTypeNames, feetToMeters } from "@/lib/format";
import { type ContentIndex, calculateSheet } from "@/rules-engine/engine";
import {
  applyDamage,
  type DamageDefense,
  type DamageOutcome,
  type DeathSaveOutcome,
  gainExhaustion,
  gainTempHp,
  heal,
  longRest,
  type PlayResult,
  reduceMaxHp,
  removeExhaustion,
  restoreMaxHp,
  rollDeathSave,
  spendHitDie,
  stabilize,
} from "@/rules-engine/engine/play-state";
import type { Character, DamageType, HitDie } from "@/rules-engine/schemas";

export type PlayMessage = { tone: "info" | "danger"; text: string };

export type PlaySession = {
  character: Character;
  message: PlayMessage | null;
};

export type PlayAction =
  | {
      type: "damage";
      amount: number;
      critical?: boolean;
      damageType?: DamageType;
    }
  | { type: "heal"; amount: number }
  | { type: "temp-hp"; amount: number }
  | { type: "spend-hit-die"; die: HitDie; roll: number }
  | { type: "long-rest" }
  | { type: "reduce-max-hp"; amount: number }
  | { type: "restore-max-hp" }
  | { type: "gain-exhaustion" }
  | { type: "remove-exhaustion" }
  | { type: "death-save"; roll: number }
  | { type: "stabilize" }
  | { type: "reset"; character: Character };

const damageText: Record<DamageOutcome, string> = {
  unharmed: "Los PG temporales absorbieron todo el daño.",
  hurt: "",
  "dropped-to-zero":
    "Caíste a 0 PG: quedás inconsciente y hacés tiradas de salvación contra muerte.",
  "damaged-at-zero":
    "Daño con 0 PG: cuenta como fallo de salvación contra muerte.",
  "instant-death": "Daño considerable: el personaje muere.",
  "death-from-failures":
    "Tercer fallo de salvación contra muerte: el personaje muere.",
};

const defenseNames: Record<DamageDefense, string> = {
  immunity: "Inmunidad",
  resistance: "Resistencia",
  vulnerability: "Vulnerabilidad",
};

// "Resistencia al veneno", "Resistencia y vulnerabilidad al fuego".
const defensesText = (defenses: DamageDefense[], type: DamageType) => {
  const names = defenses.map((d, i) =>
    i === 0 ? defenseNames[d] : defenseNames[d].toLowerCase(),
  );
  return `${names.join(" y ")} al ${damageTypeNames[type]}`;
};

const deathSaveText: Record<DeathSaveOutcome, string> = {
  success: "Éxito en la salvación contra muerte.",
  failure: "Fallo en la salvación contra muerte.",
  stabilized: "Tercer éxito: quedás estable con 0 PG.",
  died: "Tercer fallo: el personaje muere.",
  "regained-hp": "¡20 natural! Recuperás 1 PG y te despertás.",
};

export function createPlayReducer(contentIndex: ContentIndex) {
  // Aplica el resultado del motor: si salió bien, guarda el estado nuevo;
  // si no, deja el personaje como estaba y muestra el motivo.
  const apply = <D extends object>(
    session: PlaySession,
    result: PlayResult<D>,
    describe: (details: Extract<PlayResult<D>, { ok: true }>) => PlayMessage,
  ): PlaySession => {
    if (!result.ok) {
      return { ...session, message: { tone: "danger", text: result.reason } };
    }
    return {
      character: { ...session.character, playState: result.playState },
      message: describe(result as Extract<PlayResult<D>, { ok: true }>),
    };
  };

  return function playReducer(
    session: PlaySession,
    action: PlayAction,
  ): PlaySession {
    const { character } = session;
    switch (action.type) {
      case "damage":
        return apply(
          session,
          applyDamage(character, contentIndex, action.amount, {
            critical: action.critical,
            damageType: action.damageType,
          }),
          ({ outcome, hpLost, tempHpLost, damage, defenses }) => {
            const lost = [
              hpLost > 0 && `${hpLost} PG`,
              tempHpLost > 0 &&
                `${tempHpLost} ${tempHpLost === 1 ? "temporal" : "temporales"}`,
            ]
              .filter(Boolean)
              .join(" y ");
            const result =
              outcome === "hurt"
                ? `Perdiste ${lost}.`
                : outcome === "damaged-at-zero" && action.critical
                  ? "Crítico con 0 PG: cuenta como dos fallos de salvación contra muerte."
                  : outcome === "unharmed" && damage === 0
                    ? "No perdiste PG."
                    : damageText[outcome];
            // Si una defensa cambió el daño, se cuenta antes del resultado.
            const text =
              defenses.length > 0 && action.damageType
                ? `${defensesText(defenses, action.damageType)}: ${action.amount} de daño quedan en ${damage}. ${result}`
                : result;
            return {
              tone:
                outcome === "hurt" || outcome === "unharmed"
                  ? "info"
                  : "danger",
              text,
            };
          },
        );
      case "heal":
        return apply(
          session,
          heal(character, contentIndex, action.amount),
          ({ healed }) => ({
            tone: "info",
            text:
              healed > 0
                ? `Recuperaste ${healed} PG.`
                : "Ya estabas al máximo de PG.",
          }),
        );
      case "temp-hp":
        return apply(
          session,
          gainTempHp(character, action.amount),
          ({ kept, playState }) => ({
            tone: "info",
            text:
              kept === "new"
                ? `Ahora tenés ${playState.tempHp} PG temporales.`
                : `Los PG temporales no se suman: te quedás con los ${playState.tempHp} que ya tenías.`,
          }),
        );
      case "spend-hit-die":
        return apply(
          session,
          spendHitDie(character, contentIndex, action.die, action.roll),
          ({ healed }) => ({
            tone: "info",
            text: `Gastaste un ${action.die} y recuperaste ${healed} PG.`,
          }),
        );
      case "long-rest":
        return apply(
          session,
          longRest(character, contentIndex),
          ({ playState }) => ({
            tone: "info",
            text:
              character.playState.exhaustion > 0
                ? `Descanso largo: PG y dados de golpe al máximo. Cansancio: nivel ${playState.exhaustion}.`
                : "Descanso largo: PG y dados de golpe al máximo.",
          }),
        );
      case "gain-exhaustion":
      case "remove-exhaustion": {
        const result =
          action.type === "gain-exhaustion"
            ? gainExhaustion(character)
            : removeExhaustion(character);
        return apply(session, result, ({ playState }) => {
          if (playState.dead) {
            return {
              tone: "danger",
              text: "Cansancio nivel 6: el personaje muere.",
            };
          }
          if (playState.exhaustion === 0) {
            return { tone: "info", text: "Ya no tenés cansancio." };
          }
          // Las penalizaciones las calcula el motor; acá solo se cuentan.
          const { exhaustion } = calculateSheet(
            { ...character, playState },
            contentIndex,
          );
          return {
            tone: "danger",
            text: `Cansancio nivel ${exhaustion.level}: −${exhaustion.d20Penalty} a las pruebas con d20 y −${feetToMeters(exhaustion.speedPenalty)} de velocidad.`,
          };
        });
      }
      case "reduce-max-hp":
        return apply(
          session,
          reduceMaxHp(character, contentIndex, action.amount),
          ({ reducedBy, outcome }) => ({
            tone: "danger",
            text:
              outcome === "died"
                ? "Tus PG máximos llegaron a 0: el personaje muere."
                : `Tus PG máximos bajaron ${reducedBy}. Vuelven con un descanso largo.`,
          }),
        );
      case "restore-max-hp":
        return apply(session, restoreMaxHp(character, contentIndex), () => ({
          tone: "info",
          text: "Tus PG máximos vuelven a la normalidad.",
        }));
      case "death-save":
        return apply(
          session,
          rollDeathSave(character, contentIndex, action.roll),
          ({ outcome }) => ({
            tone:
              outcome === "died" || outcome === "failure" ? "danger" : "info",
            text:
              action.roll === 1 && outcome === "failure"
                ? "1 natural: cuenta como dos fallos."
                : deathSaveText[outcome],
          }),
        );
      case "stabilize":
        return apply(session, stabilize(character, contentIndex), () => ({
          tone: "info",
          text: "Estabilizado: sigue inconsciente con 0 PG, pero ya no hace salvaciones.",
        }));
      case "reset":
        return { character: action.character, message: null };
    }
  };
}
