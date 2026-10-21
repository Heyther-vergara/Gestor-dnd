import { describe, expect, it } from "vitest";

import { calculateSheet, createContentIndex } from "@/rules-engine/engine";
import {
  applyDamage,
  gainTempHp,
  heal,
  longRest,
  spendHitDie,
} from "@/rules-engine/engine/play-state";
import {
  type Character,
  characterSchema,
  type Content,
  contentSchema,
  type PlayState,
} from "@/rules-engine/schemas";

// --- Contenido mínimo: sin rasgos que cambien los PG, para que las cuentas
// de los tests dependan solo de la clase y la Constitución. ---

const content = (raw: unknown): Content => contentSchema.parse(raw);

const classData = {
  primaryAbilities: ["str"],
  savingThrows: ["str", "con"],
  skillChoices: { count: 2, options: ["athletics", "perception"] },
  armorProficiencies: [],
  weaponProficiencies: [],
  features: [],
};

const index = createContentIndex([
  content({
    id: "human",
    packageId: "srd-2024",
    type: "species",
    name: "Humano",
    description: "",
    data: { size: ["medium"], speed: 30, traits: [] },
  }),
  content({
    id: "soldier",
    packageId: "srd-2024",
    type: "background",
    name: "Soldado",
    description: "",
    data: {
      abilityOptions: ["str", "dex", "con"],
      featId: "savage-attacker",
      skillProficiencies: ["athletics", "intimidation"],
      toolProficiency: "Gaming Set",
      equipment: "",
    },
  }),
  content({
    id: "savage-attacker",
    packageId: "srd-2024",
    type: "feat",
    name: "Atacante salvaje",
    description: "",
    data: { category: "origin" },
  }),
  content({
    id: "fighter",
    packageId: "srd-2024",
    type: "class",
    name: "Guerrero",
    description: "",
    data: { ...classData, hitDie: 10 },
  }),
  content({
    id: "wizard",
    packageId: "srd-2024",
    type: "class",
    name: "Mago",
    description: "",
    data: { ...classData, hitDie: 6 },
  }),
]);

// Guerrero humano de nivel 3 con Con 14 (+2). SRD 5.2.1: 10 + 2 en el nivel 1
// y 6 + 2 en cada nivel siguiente → 28 PG máximos y 3d10.
const MAX_HP = 28;

const makeCharacter = (
  playState: Partial<PlayState> = {},
  classes: Character["classes"] = [{ classId: "fighter", level: 3 }],
): Character =>
  characterSchema.parse({
    id: "char-1",
    name: "Brunhilda",
    edition: "2024",
    activePackageIds: ["srd-2024"],
    classes,
    speciesId: "human",
    backgroundId: "soldier",
    baseAbilityScores: { str: 15, dex: 12, con: 14, int: 8, wis: 10, cha: 10 },
    playState: { damageTaken: 0, tempHp: 0, hitDiceSpent: {}, ...playState },
  });

// Aplica el estado nuevo al personaje y recalcula, como hará la interfaz.
const hitPointsAfter = (character: Character, playState: PlayState) =>
  calculateSheet({ ...character, playState }, index).hitPoints;

// Para leer el resultado sin repetir el chequeo de `ok` en cada test.
function expectOk<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error(`Se esperaba ok: ${JSON.stringify(result)}`);
  return result as Extract<T, { ok: true }>;
}

describe("fixture", () => {
  it("is a level 3 fighter with 28 HP and 3d10", () => {
    const sheet = calculateSheet(makeCharacter(), index);
    expect(sheet.issues).toEqual([]);
    expect(sheet.hitPoints.max).toBe(MAX_HP);
    expect(sheet.hitDice.byDie).toEqual({ d10: { total: 3, remaining: 3 } });
  });
});

describe("applyDamage", () => {
  it("subtracts damage from current hit points", () => {
    const character = makeCharacter();
    const result = expectOk(applyDamage(character, index, 10));
    expect(result.playState.damageTaken).toBe(10);
    expect(result.outcome).toBe("hurt");
    expect(hitPointsAfter(character, result.playState).current).toBe(18);
  });

  // SRD 5.2.1, "Puntos de golpe temporales": "si tienes 5 puntos de golpe
  // temporales y recibes 7 de daño, perderás esos puntos y luego perderás 2
  // puntos de golpe".
  it("takes damage from temporary hit points first", () => {
    const result = expectOk(
      applyDamage(makeCharacter({ tempHp: 5 }), index, 7),
    );
    expect(result).toMatchObject({ tempHpLost: 5, hpLost: 2, outcome: "hurt" });
    expect(result.playState).toMatchObject({ tempHp: 0, damageTaken: 2 });
  });

  it("is unharmed when temporary hit points absorb everything", () => {
    const result = expectOk(
      applyDamage(makeCharacter({ tempHp: 5 }), index, 3),
    );
    expect(result.outcome).toBe("unharmed");
    expect(result.playState).toMatchObject({ tempHp: 2, damageTaken: 0 });
  });

  // SRD 5.2.1, "Puntos de golpe": no bajan de 0. "Caer inconsciente".
  it("stops at 0 hit points", () => {
    const result = expectOk(
      applyDamage(makeCharacter({ damageTaken: 20 }), index, 15),
    );
    expect(result.outcome).toBe("dropped-to-zero");
    expect(result.hpLost).toBe(8);
    expect(result.playState.damageTaken).toBe(MAX_HP);
  });

  // SRD 5.2.1, "Daño considerable": con 12 PG máximos, 6 actuales y 18 de
  // daño, sobran 12, que es igual al máximo: el personaje muere.
  it("kills instantly when leftover damage reaches max hit points", () => {
    // Acá el máximo es 28: con 6 PG actuales hacen falta 6 + 28 = 34.
    const atSix = makeCharacter({ damageTaken: MAX_HP - 6 });
    expect(expectOk(applyDamage(atSix, index, 34)).outcome).toBe(
      "instant-death",
    );
    expect(expectOk(applyDamage(atSix, index, 33)).outcome).toBe(
      "dropped-to-zero",
    );
  });

  // SRD 5.2.1, "Daño con 0 puntos de golpe": cuenta como un fallo de
  // salvación contra muerte; si es mayor o igual al máximo, morís.
  it("reports damage at 0 hit points", () => {
    const down = makeCharacter({ damageTaken: MAX_HP });
    expect(expectOk(applyDamage(down, index, 5)).outcome).toBe(
      "damaged-at-zero",
    );
    expect(expectOk(applyDamage(down, index, MAX_HP)).outcome).toBe(
      "instant-death",
    );
  });

  it("rejects negative or fractional amounts", () => {
    expect(applyDamage(makeCharacter(), index, -3).ok).toBe(false);
    expect(applyDamage(makeCharacter(), index, 2.5).ok).toBe(false);
  });

  it("does not modify the original character", () => {
    const character = makeCharacter();
    applyDamage(character, index, 10);
    expect(character.playState.damageTaken).toBe(0);
  });
});

describe("heal", () => {
  // SRD 5.2.1, "Curación": "si recuperas 8 puntos de golpe como curación y
  // tienes 14 puntos de golpe, pero tus puntos de golpe máximos son 20,
  // recuperarás 6 puntos de golpe y no 8".
  it("does not go above max hit points", () => {
    const character = makeCharacter({ damageTaken: 6 });
    const result = expectOk(heal(character, index, 8));
    expect(result.healed).toBe(6);
    expect(hitPointsAfter(character, result.playState).current).toBe(MAX_HP);
  });

  it("adds healing to current hit points", () => {
    const result = expectOk(heal(makeCharacter({ damageTaken: 20 }), index, 5));
    expect(result.healed).toBe(5);
    expect(result.playState.damageTaken).toBe(15);
  });

  // Daño guardado mayor que el máximo (datos viejos): se cura desde 0.
  it("heals from 0 even if stored damage exceeds max", () => {
    const result = expectOk(heal(makeCharacter({ damageTaken: 99 }), index, 3));
    expect(result.healed).toBe(3);
    expect(result.playState.damageTaken).toBe(MAX_HP - 3);
  });

  // SRD 5.2.1, "Puntos de golpe temporales": no se recuperan con curación.
  it("does not touch temporary hit points", () => {
    const result = expectOk(
      heal(makeCharacter({ damageTaken: 5, tempHp: 2 }), index, 5),
    );
    expect(result.playState.tempHp).toBe(2);
  });
});

describe("gainTempHp", () => {
  // SRD 5.2.1, "Puntos de golpe temporales": no se suman; "si un conjuro te
  // concede 12 puntos de golpe temporales cuando ya tienes 10, solo puedes
  // tener 12 o 10, no 22".
  it("does not stack and keeps the higher amount", () => {
    const more = expectOk(gainTempHp(makeCharacter({ tempHp: 10 }), 12));
    expect(more).toMatchObject({ kept: "new", playState: { tempHp: 12 } });

    const less = expectOk(gainTempHp(makeCharacter({ tempHp: 10 }), 4));
    expect(less).toMatchObject({ kept: "current", playState: { tempHp: 10 } });
  });

  // "Una criatura puede tener todos sus puntos de golpe y recibir puntos de
  // golpe temporales". Tampoco cuentan como curación.
  it("works at full hit points without healing", () => {
    const result = expectOk(gainTempHp(makeCharacter(), 5));
    expect(result.playState).toEqual({
      damageTaken: 0,
      tempHp: 5,
      hitDiceSpent: {},
    });
  });
});

describe("spendHitDie (short rest)", () => {
  // SRD 5.2.1, "Descanso corto": tirás el dado, sumás el modificador por
  // Constitución y recuperás el total, con un mínimo de 1.
  it("heals roll + Con modifier and marks the die as spent", () => {
    const result = expectOk(
      spendHitDie(makeCharacter({ damageTaken: 20 }), index, "d10", 7),
    );
    expect(result.healed).toBe(7 + 2);
    expect(result.playState).toMatchObject({
      damageTaken: 11,
      hitDiceSpent: { d10: 1 },
    });
  });

  it("heals at least 1 hit point", () => {
    // Con 6 (−2): un 1 en el dado daría −1, pero se recupera 1.
    const frail = characterSchema.parse({
      ...makeCharacter({ damageTaken: 5 }),
      baseAbilityScores: { str: 15, dex: 12, con: 6, int: 8, wis: 10, cha: 10 },
    });
    expect(expectOk(spendHitDie(frail, index, "d10", 1)).healed).toBe(1);
  });

  it("does not go above max hit points", () => {
    const result = expectOk(
      spendHitDie(makeCharacter({ damageTaken: 3 }), index, "d10", 10),
    );
    expect(result.healed).toBe(3);
    expect(result.playState.hitDiceSpent).toEqual({ d10: 1 });
  });

  it("fails when no dice of that type remain", () => {
    const spent = makeCharacter({ damageTaken: 10, hitDiceSpent: { d10: 3 } });
    expect(spendHitDie(spent, index, "d10", 5).ok).toBe(false);
    // Un guerrero no tiene d6.
    expect(spendHitDie(makeCharacter(), index, "d6", 3).ok).toBe(false);
  });

  // SRD 5.2.1, "Multiclase": los dados de distinto tipo se cuentan aparte.
  it("tracks spent dice by type when multiclassing", () => {
    const multiclass = makeCharacter({ damageTaken: 10 }, [
      { classId: "fighter", level: 2 },
      { classId: "wizard", level: 1 },
    ]);
    const result = expectOk(spendHitDie(multiclass, index, "d6", 4));
    expect(result.playState.hitDiceSpent).toEqual({ d6: 1 });
    const sheet = calculateSheet(
      { ...multiclass, playState: result.playState },
      index,
    );
    expect(sheet.hitDice.byDie).toEqual({
      d10: { total: 2, remaining: 2 },
      d6: { total: 1, remaining: 0 },
    });
  });

  it("rejects rolls outside the die", () => {
    const hurt = makeCharacter({ damageTaken: 10 });
    expect(spendHitDie(hurt, index, "d10", 0).ok).toBe(false);
    expect(spendHitDie(hurt, index, "d10", 11).ok).toBe(false);
  });

  // SRD 5.2.1, "Descanso corto": para comenzarlo necesitás al menos 1 PG.
  it("fails at 0 hit points", () => {
    const down = makeCharacter({ damageTaken: MAX_HP });
    expect(spendHitDie(down, index, "d10", 5)).toEqual({
      ok: false,
      reason: "Para descansar necesitás al menos 1 punto de golpe",
    });
  });
});

describe("longRest", () => {
  // SRD 5.2.1, "Descanso largo": recuperás todos los PG perdidos y todos los
  // dados de golpe gastados. "Puntos de golpe temporales": duran hasta que
  // finalizás un descanso largo.
  it("restores hit points and hit dice and clears temporary hit points", () => {
    const tired = makeCharacter({
      damageTaken: 20,
      tempHp: 4,
      hitDiceSpent: { d10: 2 },
    });
    const result = expectOk(longRest(tired, index));
    expect(result.playState).toEqual({
      damageTaken: 0,
      tempHp: 0,
      hitDiceSpent: {},
    });
  });

  // SRD 5.2.1, "Descanso largo": para comenzarlo necesitás al menos 1 PG.
  it("fails at 0 hit points", () => {
    expect(longRest(makeCharacter({ damageTaken: MAX_HP }), index).ok).toBe(
      false,
    );
  });
});
