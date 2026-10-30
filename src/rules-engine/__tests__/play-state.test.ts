import { describe, expect, it } from "vitest";

import { calculateSheet, createContentIndex } from "@/rules-engine/engine";
import {
  applyDamage,
  gainExhaustion,
  gainTempHp,
  heal,
  longRest,
  reduceMaxHp,
  removeExhaustion,
  restoreMaxHp,
  rollDeathSave,
  spendHitDie,
  stabilize,
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
  // Defensas contra el daño para los tests de tipos de daño. Fuego tiene
  // resistencia y vulnerabilidad a la vez, como el ejemplo del SRD.
  content({
    id: "warding-amulet",
    packageId: "srd-2024",
    type: "item",
    name: "Amuleto de protección",
    description: "",
    effects: [
      { target: "resistance.poison", op: "grant" },
      { target: "resistance.fire", op: "grant" },
      { target: "vulnerability.fire", op: "grant" },
      { target: "vulnerability.cold", op: "grant" },
      { target: "immunity.necrotic", op: "grant" },
    ],
    data: { category: "magic" },
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

describe("applyDamage with a damage type", () => {
  const warded = (playState: Partial<PlayState> = {}) => ({
    ...makeCharacter(playState),
    inventory: [
      { itemId: "warding-amulet", quantity: 1, equipped: true, attuned: false },
    ],
  });

  // SRD 5.2.1, "Resistencia y vulnerabilidad": con resistencia, el daño de
  // ese tipo se reduce a la mitad (redondeando hacia abajo).
  it("halves damage with resistance, rounding down", () => {
    const result = expectOk(
      applyDamage(warded(), index, 7, { damageType: "poison" }),
    );
    expect(result).toMatchObject({ damage: 3, defenses: ["resistance"] });
    expect(result.playState.damageTaken).toBe(3);
  });

  // "Si tienes vulnerabilidad a un tipo de daño, el daño de ese tipo se duplica".
  it("doubles damage with vulnerability", () => {
    const result = expectOk(
      applyDamage(warded(), index, 5, { damageType: "cold" }),
    );
    expect(result).toMatchObject({ damage: 10, defenses: ["vulnerability"] });
    expect(result.playState.damageTaken).toBe(10);
  });

  // "Orden de aplicación": primero los ajustes, después las resistencias y
  // por último las vulnerabilidades. Del ejemplo del SRD: 23 de fuego se
  // reduce a la mitad (11) y luego se duplica (22).
  it("applies resistance before vulnerability", () => {
    const result = expectOk(
      applyDamage(warded(), index, 23, { damageType: "fire" }),
    );
    expect(result).toMatchObject({
      damage: 22,
      defenses: ["resistance", "vulnerability"],
    });
  });

  // SRD 5.2.1, "Inmunidad": no recibís daño de ese tipo.
  it("ignores damage with immunity", () => {
    const result = expectOk(
      applyDamage(warded(), index, 12, { damageType: "necrotic" }),
    );
    expect(result).toMatchObject({
      damage: 0,
      defenses: ["immunity"],
      outcome: "unharmed",
    });
    expect(result.playState.damageTaken).toBe(0);
  });

  // Con 0 PG, el daño que no llega por inmunidad no es "daño con 0 PG".
  it("adds no death save failure when immunity stops the damage", () => {
    const down = warded({ damageTaken: MAX_HP });
    const result = expectOk(
      applyDamage(down, index, 12, { damageType: "necrotic" }),
    );
    expect(result.playState.deathSaves.failures).toBe(0);
  });

  it("leaves damage of other types or without a type as it is", () => {
    expect(
      expectOk(applyDamage(warded(), index, 7, { damageType: "acid" })),
    ).toMatchObject({ damage: 7, defenses: [] });
    expect(expectOk(applyDamage(warded(), index, 7))).toMatchObject({
      damage: 7,
      defenses: [],
    });
  });

  // Los PG temporales y el daño considerable se calculan con el daño ya
  // reducido: 12 de veneno con resistencia son 6, y 5 los absorben.
  it("applies temporary hit points to the reduced damage", () => {
    const result = expectOk(
      applyDamage(warded({ tempHp: 5 }), index, 12, { damageType: "poison" }),
    );
    expect(result).toMatchObject({ damage: 6, tempHpLost: 5, hpLost: 1 });
  });

  it("uses the reduced damage for massive damage", () => {
    // Con 6 PG y 28 de máximo, morir al instante pide 34. Con resistencia,
    // 60 de veneno son 30: cae a 0 pero no muere.
    const atSix = warded({ damageTaken: MAX_HP - 6 });
    expect(
      expectOk(applyDamage(atSix, index, 60, { damageType: "poison" })).outcome,
    ).toBe("dropped-to-zero");
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
    expect(result.playState).toMatchObject({ damageTaken: 0, tempHp: 5 });
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
      deathSaves: { successes: 0, failures: 0 },
      stable: false,
      dead: false,
      maxHpReduction: 0,
      exhaustion: 0,
    });
  });

  // SRD 5.2.1, "Cansancio", "Eliminar niveles de cansancio": tras finalizar
  // un descanso largo, restá 1 nivel.
  it("removes one level of exhaustion", () => {
    const result = expectOk(longRest(makeCharacter({ exhaustion: 3 }), index));
    expect(result.playState.exhaustion).toBe(2);
  });

  // SRD 5.2.1, "Descanso largo", "Puntos de golpe al máximo": si tus PG
  // máximos se habían reducido, vuelven a la normalidad.
  it("restores reduced max hit points", () => {
    const drained = makeCharacter({ maxHpReduction: 8, damageTaken: 5 });
    const result = expectOk(longRest(drained, index));
    expect(result.playState).toMatchObject({
      maxHpReduction: 0,
      damageTaken: 0,
    });
    expect(hitPointsAfter(drained, result.playState)).toMatchObject({
      max: MAX_HP,
      current: MAX_HP,
    });
  });

  // SRD 5.2.1, "Descanso largo": para comenzarlo necesitás al menos 1 PG.
  it("fails at 0 hit points", () => {
    expect(longRest(makeCharacter({ damageTaken: MAX_HP }), index).ok).toBe(
      false,
    );
  });
});

// --- PG máximos reducidos (ADR 0012) ---

describe("reduceMaxHp", () => {
  // SRD 5.2.1, "Curación": tus PG no pueden superar tus PG máximos. Si
  // estabas al máximo, bajás con él.
  it("lowers max hit points and caps current hit points", () => {
    const character = makeCharacter();
    const result = expectOk(reduceMaxHp(character, index, 5));
    expect(result).toMatchObject({ reducedBy: 5, outcome: "reduced" });
    expect(hitPointsAfter(character, result.playState)).toMatchObject({
      max: MAX_HP - 5,
      current: MAX_HP - 5,
    });
  });

  // Si ya estabas herido por debajo del máximo nuevo, tus PG actuales no
  // cambian: la reducción no es daño.
  it("keeps current hit points that fit under the new max", () => {
    const hurt = makeCharacter({ damageTaken: 10 }); // 18 de 28
    const result = expectOk(reduceMaxHp(hurt, index, 5));
    expect(hitPointsAfter(hurt, result.playState)).toMatchObject({
      max: 23,
      current: 18,
    });
  });

  it("adds up several reductions", () => {
    const drained = makeCharacter({ maxHpReduction: 4 });
    const result = expectOk(reduceMaxHp(drained, index, 3));
    expect(result.playState.maxHpReduction).toBe(7);
  });

  // SRD 5.2.1, "Puntos de golpe máximos de 0": una criatura muere si sus PG
  // máximos llegan a 0. La reducción no pasa del máximo.
  it("kills when max hit points reach 0", () => {
    const result = expectOk(reduceMaxHp(makeCharacter(), index, 40));
    expect(result).toMatchObject({ reducedBy: MAX_HP, outcome: "died" });
    expect(result.playState).toMatchObject({
      maxHpReduction: MAX_HP,
      dead: true,
    });
  });

  it("caps healing at the reduced max", () => {
    const drained = makeCharacter({ maxHpReduction: 8, damageTaken: 10 });
    const result = expectOk(heal(drained, index, 50));
    expect(hitPointsAfter(drained, result.playState).current).toBe(20);
  });

  it("rejects invalid amounts and dead characters", () => {
    expect(reduceMaxHp(makeCharacter(), index, -1).ok).toBe(false);
    expect(reduceMaxHp(makeCharacter({ dead: true }), index, 1).ok).toBe(false);
  });
});

describe("restoreMaxHp", () => {
  // SRD 5.2.1, conjuro "Restablecimiento mayor": elimina "cualquier reducción
  // de los puntos de golpe máximos". Los PG actuales no suben: no es curación.
  it("removes the reduction without healing", () => {
    const drained = makeCharacter({ maxHpReduction: 8 }); // 20 de 20
    const result = expectOk(restoreMaxHp(drained, index));
    expect(result.playState.maxHpReduction).toBe(0);
    expect(hitPointsAfter(drained, result.playState)).toMatchObject({
      max: MAX_HP,
      current: 20,
    });
  });

  it("fails when max hit points are not reduced", () => {
    expect(restoreMaxHp(makeCharacter(), index).ok).toBe(false);
  });
});

// --- Cansancio (ADR 0012) ---

describe("gainExhaustion", () => {
  // SRD 5.2.1, "Cansancio", "Niveles de cansancio": es acumulativo; cada vez
  // que lo recibís sumás 1 nivel.
  it("adds one level", () => {
    const result = expectOk(gainExhaustion(makeCharacter({ exhaustion: 1 })));
    expect(result).toMatchObject({ outcome: "exhausted" });
    expect(result.playState.exhaustion).toBe(2);
  });

  // "Morirás si tu nivel de cansancio es 6".
  it("kills at level 6", () => {
    const result = expectOk(gainExhaustion(makeCharacter({ exhaustion: 5 })));
    expect(result.outcome).toBe("died");
    expect(result.playState).toMatchObject({ exhaustion: 6, dead: true });
  });

  it("rejects a dead character", () => {
    expect(gainExhaustion(makeCharacter({ dead: true })).ok).toBe(false);
  });
});

describe("removeExhaustion", () => {
  // Para efectos que quitan un nivel fuera del descanso largo, como el
  // conjuro "Restablecimiento mayor" ("1 nivel de cansancio").
  it("removes one level", () => {
    const result = expectOk(removeExhaustion(makeCharacter({ exhaustion: 2 })));
    expect(result.playState.exhaustion).toBe(1);
  });

  it("fails without exhaustion", () => {
    expect(removeExhaustion(makeCharacter()).ok).toBe(false);
  });
});

// --- Salvaciones contra muerte (ADR 0010) ---

// Personaje con 0 PG y, si se indica, salvaciones ya hechas.
const makeDown = (playState: Partial<PlayState> = {}) =>
  makeCharacter({ damageTaken: MAX_HP, ...playState });
const saves = (successes: number, failures: number) => ({
  successes,
  failures,
});

describe("death saves after damage", () => {
  // SRD 5.2.1, "Daño considerable": el personaje muere y queda guardado.
  it("marks the character as dead on massive damage", () => {
    const atSix = makeCharacter({ damageTaken: MAX_HP - 6 });
    expect(expectOk(applyDamage(atSix, index, 34)).playState.dead).toBe(true);
    expect(expectOk(applyDamage(atSix, index, 33)).playState.dead).toBe(false);
  });

  // SRD 5.2.1, "Daño con 0 puntos de golpe": "es lo mismo que fallar en una
  // tirada de salvación contra muerte".
  it("adds one failure when damaged at 0 hit points", () => {
    const result = expectOk(applyDamage(makeDown(), index, 5));
    expect(result.playState.deathSaves).toEqual(saves(0, 1));
  });

  // "Si el daño lo causa un crítico, equivale a dos fallos".
  it("adds two failures on a critical hit", () => {
    const result = expectOk(
      applyDamage(makeDown(), index, 5, { critical: true }),
    );
    expect(result.playState.deathSaves).toEqual(saves(0, 2));
  });

  // "Con tu tercer fallo morirás".
  it("dies on the third failure", () => {
    const twoFailures = makeDown({ deathSaves: saves(1, 2) });
    const result = expectOk(applyDamage(twoFailures, index, 1));
    expect(result.outcome).toBe("death-from-failures");
    expect(result.playState).toMatchObject({
      dead: true,
      deathSaves: saves(1, 3),
    });
  });

  it("does not count more than three failures", () => {
    const twoFailures = makeDown({ deathSaves: saves(0, 2) });
    const result = expectOk(
      applyDamage(twoFailures, index, 1, { critical: true }),
    );
    expect(result.playState.deathSaves.failures).toBe(3);
  });

  // "Estabilizar a un personaje": "Si la criatura sufre daño, dejará de estar
  // estable y empezará a hacer tiradas de salvación contra muerte otra vez".
  it("stops being stable when damaged", () => {
    const result = expectOk(applyDamage(makeDown({ stable: true }), index, 2));
    expect(result.playState).toMatchObject({
      stable: false,
      deathSaves: saves(0, 1),
    });
  });

  // Los PG temporales evitan la pérdida de PG reales: sin daño a los PG no
  // hay fallo (ADR 0010).
  it("does not add a failure when temporary hit points absorb the damage", () => {
    const result = expectOk(applyDamage(makeDown({ tempHp: 5 }), index, 3));
    expect(result.playState.deathSaves).toEqual(saves(0, 0));
  });

  it("starts with no saves when dropping to 0", () => {
    const result = expectOk(
      applyDamage(makeCharacter({ damageTaken: 20 }), index, 8),
    );
    expect(result.playState).toMatchObject({
      deathSaves: saves(0, 0),
      stable: false,
      dead: false,
    });
  });
});

describe("rollDeathSave", () => {
  // SRD 5.2.1, "Tres éxitos o fallos": 10 o más es éxito; si no, fallo.
  it("counts 10 or more as a success and less as a failure", () => {
    expect(expectOk(rollDeathSave(makeDown(), index, 10))).toMatchObject({
      outcome: "success",
      playState: { deathSaves: saves(1, 0) },
    });
    expect(expectOk(rollDeathSave(makeDown(), index, 9))).toMatchObject({
      outcome: "failure",
      playState: { deathSaves: saves(0, 1) },
    });
  });

  // "Los éxitos y los fallos no tienen por qué ser consecutivos".
  it("keeps both counts until one reaches three", () => {
    const mixed = makeDown({ deathSaves: saves(1, 1) });
    expect(
      expectOk(rollDeathSave(mixed, index, 15)).playState.deathSaves,
    ).toEqual(saves(2, 1));
  });

  // "En tu tercer éxito te estabilizarás". "La cantidad de ambos vuelve a
  // cero si [...] te estabilizas".
  it("stabilizes on the third success and resets the counts", () => {
    const result = expectOk(
      rollDeathSave(makeDown({ deathSaves: saves(2, 2) }), index, 12),
    );
    expect(result.outcome).toBe("stabilized");
    expect(result.playState).toMatchObject({
      stable: true,
      deathSaves: saves(0, 0),
    });
  });

  it("dies on the third failure", () => {
    const result = expectOk(
      rollDeathSave(makeDown({ deathSaves: saves(2, 2) }), index, 4),
    );
    expect(result.outcome).toBe("died");
    expect(result.playState).toMatchObject({
      dead: true,
      deathSaves: saves(2, 3),
    });
  });

  // "Sacar 1 o 20": un 1 cuenta como dos fallos.
  it("counts a natural 1 as two failures", () => {
    const result = expectOk(rollDeathSave(makeDown(), index, 1));
    expect(result.playState.deathSaves).toEqual(saves(0, 2));
    const oneFailure = makeDown({ deathSaves: saves(0, 2) });
    expect(expectOk(rollDeathSave(oneFailure, index, 1))).toMatchObject({
      outcome: "died",
      playState: { deathSaves: saves(0, 3) },
    });
  });

  // "Si sacas un 20, recuperas 1 punto de golpe", y con eso las cuentas
  // vuelven a cero.
  it("regains 1 hit point on a natural 20", () => {
    const character = makeDown({ deathSaves: saves(1, 2) });
    const result = expectOk(rollDeathSave(character, index, 20));
    expect(result.outcome).toBe("regained-hp");
    expect(result.playState.deathSaves).toEqual(saves(0, 0));
    expect(hitPointsAfter(character, result.playState).current).toBe(1);
  });

  it("rejects rolls outside the d20", () => {
    expect(rollDeathSave(makeDown(), index, 0).ok).toBe(false);
    expect(rollDeathSave(makeDown(), index, 21).ok).toBe(false);
    expect(rollDeathSave(makeDown(), index, 7.5).ok).toBe(false);
  });

  // "Siempre que empieces tu turno con 0 puntos de golpe". "Una criatura
  // estable no tendrá que hacer tiradas de salvación contra muerte".
  it("only rolls at 0 hit points, when not stable and alive", () => {
    expect(rollDeathSave(makeCharacter(), index, 12).ok).toBe(false);
    expect(rollDeathSave(makeDown({ stable: true }), index, 12).ok).toBe(false);
    expect(rollDeathSave(makeDown({ dead: true }), index, 12).ok).toBe(false);
  });
});

describe("stabilize", () => {
  // SRD 5.2.1, "Estabilizar a un personaje": con una prueba de Sabiduría
  // (Medicina) CD 10 superada. La cuenta vuelve a cero.
  it("makes a dying character stable and resets the counts", () => {
    const result = expectOk(
      stabilize(makeDown({ deathSaves: saves(1, 2) }), index),
    );
    expect(result.playState).toMatchObject({
      stable: true,
      deathSaves: saves(0, 0),
      damageTaken: MAX_HP,
    });
  });

  it("only works on a dying character", () => {
    expect(stabilize(makeCharacter(), index).ok).toBe(false);
    expect(stabilize(makeDown({ stable: true }), index).ok).toBe(false);
    expect(stabilize(makeDown({ dead: true }), index).ok).toBe(false);
  });
});

describe("healing a dying character", () => {
  // SRD 5.2.1: "La cantidad de ambos vuelve a cero si recuperas puntos de
  // golpe". "Caer inconsciente": hasta que recuperes cualquier cantidad.
  it("resets the counts and stability when healed", () => {
    const result = expectOk(
      heal(makeDown({ deathSaves: saves(2, 1), stable: true }), index, 3),
    );
    expect(result.playState).toMatchObject({
      deathSaves: saves(0, 0),
      stable: false,
    });
  });

  it("keeps the counts when healing 0", () => {
    const result = expectOk(
      heal(makeDown({ deathSaves: saves(2, 1) }), index, 0),
    );
    expect(result.playState.deathSaves).toEqual(saves(2, 1));
  });
});

describe("a dead character", () => {
  // La curación normal no revive: hace falta magia como alzar a los muertos,
  // que todavía no está modelada.
  it("cannot be damaged, healed, gain temp HP or rest", () => {
    const dead = makeDown({ dead: true });
    for (const result of [
      applyDamage(dead, index, 3),
      heal(dead, index, 5),
      gainTempHp(dead, 5),
      spendHitDie(dead, index, "d10", 4),
      longRest(dead, index),
    ]) {
      expect(result).toEqual({ ok: false, reason: "El personaje está muerto" });
    }
  });
});

describe("sheet death save status", () => {
  const status = (playState: Partial<PlayState>) =>
    calculateSheet(makeCharacter(playState), index).deathSaves;

  it("derives the status from hit points and stored state", () => {
    expect(status({}).status).toBe("conscious");
    expect(status({ damageTaken: MAX_HP })).toEqual({
      status: "dying",
      ...saves(0, 0),
    });
    expect(status({ damageTaken: MAX_HP, stable: true }).status).toBe("stable");
    expect(status({ damageTaken: MAX_HP, dead: true }).status).toBe("dead");
  });
});
