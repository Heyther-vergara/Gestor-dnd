// Reducer de la hoja en partida: traduce cada botón a una acción del motor y
// arma el mensaje que ve el jugador. No conoce reglas: las decide el motor.
// Es una función pura para usarla con useReducer de React y poder testearla.

import type { ContentIndex } from "@/rules-engine/engine";
import {
  applyDamage,
  type DamageOutcome,
  gainTempHp,
  heal,
  longRest,
  type PlayResult,
  spendHitDie,
} from "@/rules-engine/engine/play-state";
import type { Character, HitDie } from "@/rules-engine/schemas";

export type PlayMessage = { tone: "info" | "danger"; text: string };

export type PlaySession = {
  character: Character;
  message: PlayMessage | null;
};

export type PlayAction =
  | { type: "damage"; amount: number }
  | { type: "heal"; amount: number }
  | { type: "temp-hp"; amount: number }
  | { type: "spend-hit-die"; die: HitDie; roll: number }
  | { type: "long-rest" }
  | { type: "reset"; character: Character };

const damageText: Record<DamageOutcome, string> = {
  unharmed: "Los PG temporales absorbieron todo el daño.",
  hurt: "",
  "dropped-to-zero":
    "Caíste a 0 PG: quedás inconsciente y hacés tiradas de salvación contra muerte.",
  "damaged-at-zero":
    "Daño con 0 PG: cuenta como un fallo de salvación contra muerte (dos si fue crítico).",
  "instant-death": "Daño considerable: el personaje muere.",
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
          applyDamage(character, contentIndex, action.amount),
          ({ outcome, hpLost, tempHpLost }) => {
            const lost = [
              hpLost > 0 && `${hpLost} PG`,
              tempHpLost > 0 &&
                `${tempHpLost} ${tempHpLost === 1 ? "temporal" : "temporales"}`,
            ]
              .filter(Boolean)
              .join(" y ");
            const text =
              outcome === "hurt" ? `Perdiste ${lost}.` : damageText[outcome];
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
        return apply(session, longRest(character, contentIndex), () => ({
          tone: "info",
          text: "Descanso largo: PG y dados de golpe al máximo.",
        }));
      case "reset":
        return { character: action.character, message: null };
    }
  };
}
