import { describe, expect, it } from "vitest";

import { createPlayReducer, type PlaySession } from "@/lib/play-reducer";
import { sampleCharacter } from "@/lib/sample-character";
import { srd2024Index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";

// El reducer solo traduce botones a acciones del motor; las reglas se testean
// en rules-engine. Acá se comprueba que el estado y el mensaje cuadren.
const reducer = createPlayReducer(srd2024Index);
const start: PlaySession = { character: sampleCharacter, message: null };
const currentHp = (session: PlaySession) =>
  calculateSheet(session.character, srd2024Index).hitPoints.current;

describe("play reducer (Brunhilda: 22 of 31 HP)", () => {
  it("applies damage and says how much was lost", () => {
    const next = reducer(start, { type: "damage", amount: 5 });
    expect(currentHp(next)).toBe(17);
    expect(next.message).toEqual({ tone: "info", text: "Perdiste 5 PG." });
  });

  it("warns when the character drops to 0", () => {
    const next = reducer(start, { type: "damage", amount: 30 });
    expect(currentHp(next)).toBe(0);
    expect(next.message?.tone).toBe("danger");
  });

  it("keeps the character and shows the reason when an action fails", () => {
    const next = reducer(start, { type: "heal", amount: Number.NaN });
    expect(next.character).toBe(sampleCharacter);
    expect(next.message?.tone).toBe("danger");
  });

  it("spends a hit die and heals", () => {
    const next = reducer(start, { type: "spend-hit-die", die: "d10", roll: 4 });
    // Con 14 (+2): 4 + 2 = 6.
    expect(currentHp(next)).toBe(28);
    expect(next.character.playState.hitDiceSpent).toEqual({ d10: 1 });
  });

  it("resets to the given character", () => {
    const hurt = reducer(start, { type: "damage", amount: 5 });
    const reset = reducer(hurt, { type: "reset", character: sampleCharacter });
    expect(reset).toEqual(start);
  });
});
