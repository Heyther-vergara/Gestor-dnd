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

  // Brunhilda es enana: "Resistencia enana" reduce el veneno a la mitad.
  it("explains when a resistance changes the damage", () => {
    const next = reducer(start, {
      type: "damage",
      amount: 7,
      damageType: "poison",
    });
    expect(currentHp(next)).toBe(19);
    expect(next.message?.text).toBe(
      "Resistencia al veneno: 7 de daño quedan en 3. Perdiste 3 PG.",
    );
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

  it("counts a critical hit at 0 HP as two failures", () => {
    const down = reducer(start, { type: "damage", amount: 30 });
    const crit = reducer(down, { type: "damage", amount: 1, critical: true });
    expect(crit.character.playState.deathSaves).toEqual({
      successes: 0,
      failures: 2,
    });
    expect(crit.message?.text).toContain("dos fallos");
  });

  it("rolls death saves and stabilizes on the third success", () => {
    let session = reducer(start, { type: "damage", amount: 30 });
    session = reducer(session, { type: "death-save", roll: 12 });
    expect(session.message?.tone).toBe("info");
    session = reducer(session, { type: "death-save", roll: 3 });
    expect(session.message?.tone).toBe("danger");
    session = reducer(session, { type: "death-save", roll: 10 });
    session = reducer(session, { type: "death-save", roll: 18 });
    expect(calculateSheet(session.character, srd2024Index).deathSaves).toEqual({
      status: "stable",
      successes: 0,
      failures: 0,
    });
  });

  it("explains that a natural 1 counts as two failures", () => {
    const down = reducer(start, { type: "damage", amount: 30 });
    const one = reducer(down, { type: "death-save", roll: 1 });
    expect(one.message?.text).toBe("1 natural: cuenta como dos fallos.");
  });

  it("stabilizes a dying character", () => {
    const down = reducer(start, { type: "damage", amount: 30 });
    const stable = reducer(down, { type: "stabilize" });
    expect(stable.character.playState.stable).toBe(true);
  });

  it("reduces and restores max hit points", () => {
    const drained = reducer(start, { type: "reduce-max-hp", amount: 12 });
    const sheet = calculateSheet(drained.character, srd2024Index);
    // 31 − 12 = 19: los 22 PG actuales bajan a 19.
    expect(sheet.hitPoints).toMatchObject({ max: 19, current: 19 });
    expect(drained.message).toEqual({
      tone: "danger",
      text: "Tus PG máximos bajaron 12. Vuelven con un descanso largo.",
    });
    const restored = reducer(drained, { type: "restore-max-hp" });
    expect(
      calculateSheet(restored.character, srd2024Index).hitPoints,
    ).toMatchObject({
      max: 31,
      current: 19,
    });
  });

  it("says when max hit points reach 0", () => {
    const next = reducer(start, { type: "reduce-max-hp", amount: 31 });
    expect(next.message?.text).toBe(
      "Tus PG máximos llegaron a 0: el personaje muere.",
    );
  });

  it("adds and removes exhaustion levels", () => {
    const once = reducer(start, { type: "gain-exhaustion" });
    const twice = reducer(once, { type: "gain-exhaustion" });
    expect(twice.character.playState.exhaustion).toBe(2);
    expect(twice.message).toEqual({
      tone: "danger",
      text: "Cansancio nivel 2: −4 a las pruebas con d20 y −3 m de velocidad.",
    });
    const better = reducer(twice, { type: "remove-exhaustion" });
    expect(better.character.playState.exhaustion).toBe(1);
  });

  it("says that a long rest removes one exhaustion level", () => {
    let session = reducer(start, { type: "gain-exhaustion" });
    session = reducer(session, { type: "gain-exhaustion" });
    session = reducer(session, { type: "long-rest" });
    expect(session.message?.text).toBe(
      "Descanso largo: PG y dados de golpe al máximo. Cansancio: nivel 1.",
    );
  });

  it("resets to the given character", () => {
    const hurt = reducer(start, { type: "damage", amount: 5 });
    const reset = reducer(hurt, { type: "reset", character: sampleCharacter });
    expect(reset).toEqual(start);
  });
});
