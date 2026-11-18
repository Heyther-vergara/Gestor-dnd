import { describe, expect, it } from "vitest";

import {
  applyLevelUp,
  emptyLevelUpDraft,
  hitPointGain,
  improvementBonuses,
  type LevelUpDraft,
  type LevelUpPlan,
  levelUpErrors,
  planLevelUp,
} from "@/lib/level-up";
import { srd2024Index as index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";
import {
  type Character,
  type CharacterInput,
  characterSchema,
} from "@/rules-engine/schemas";

// Los conjuros de nivel 1 del mago, en el orden de la lista.
const LEVEL_1_SPELLS = [...index.values()]
  .filter((c) => c.type === "spell" && c.data.level === 1)
  .map((c) => c.id)
  .sort();

// La clase mago con lo que le corresponde al nivel (ADR 0021): 3 trucos (4
// desde el nivel 4) y un libro con 6 conjuros más 2 por nivel después del 1.
const wizardClass = (level: number, subclassId?: string) => ({
  classId: "wizard",
  level,
  ...(subclassId && { subclassId }),
  cantripIds: ["light", "mage-hand", "ray-of-frost", "fire-bolt"].slice(
    0,
    level >= 4 ? 4 : 3,
  ),
  spellbookIds: LEVEL_1_SPELLS.slice(0, 6 + 2 * (level - 1)),
});

// Elige los primeros conjuros que ofrece el plan.
const firstSpells = (plan: LevelUpPlan) => ({
  cantripIds:
    plan.spells?.cantrips.options
      .slice(0, plan.spells.cantrips.count)
      .map((s) => s.id) ?? [],
  spellbookIds:
    plan.spells?.spellbook.options
      .slice(0, plan.spells.spellbook.count)
      .map((s) => s.id) ?? [],
});

// Mago humano erudito: Int 15 + 2 = 17, Con 13 + 1 = 14 (+2).
const wizardAt = (
  level: number,
  overrides: Partial<CharacterInput> = {},
): Character =>
  characterSchema.parse({
    id: "w",
    name: "Ilse",
    edition: "2024",
    activePackageIds: ["srd-2024"],
    classes: [wizardClass(level)],
    speciesId: "human",
    backgroundId: "sage",
    baseAbilityScores: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
    choices: [
      {
        kind: "ability-bonus",
        contentId: "sage",
        level: 1,
        bonuses: { int: 2, con: 1 },
      },
    ],
    ...overrides,
  });

function planFor(character: Character): LevelUpPlan {
  const check = planLevelUp(character, index);
  if (!check.ok) throw new Error(check.reason);
  return check.plan;
}

describe("planLevelUp", () => {
  // SRD 5.2.1, tabla "Rasgos de mago": nivel 2 "Académico".
  it("lists the class features of the next level", () => {
    const plan = planFor(wizardAt(1));
    expect(plan.level).toBe(2);
    expect(plan.features.map((f) => f.name)).toEqual(["Scholar"]);
    expect(plan.subclassOptions).toEqual([]);
    expect(plan.needsImprovement).toBe(false);
  });

  // SRD 5.2.1, "Subclase de mago" (nivel 3): la del SRD es el Evocador.
  it("offers the subclasses of the class at level 3", () => {
    const plan = planFor(wizardAt(2));
    expect(plan.subclassOptions.map((s) => s.id)).toEqual(["evoker"]);
  });

  // SRD 5.2.1, "Mejora de característica" (nivel 4).
  it("asks for an ability score improvement at level 4", () => {
    expect(planFor(wizardAt(3)).needsImprovement).toBe(true);
  });

  it("stops at level 5, the last level with content", () => {
    expect(planLevelUp(wizardAt(5), index)).toEqual({
      ok: false,
      reason: "Por ahora el nivel máximo es 5.",
    });
  });

  it("does not level up a multiclass character", () => {
    const multiclass = wizardAt(2, {
      classes: [wizardClass(2), { classId: "fighter", level: 1 }],
    });
    expect(planLevelUp(multiclass, index).ok).toBe(false);
  });
});

describe("improvementBonuses", () => {
  it("turns the plan into the saved bonuses", () => {
    expect(improvementBonuses({ mode: "plus-two", ability: "int" })).toEqual({
      int: 2,
    });
    expect(
      improvementBonuses({ mode: "one-one", first: "int", second: "con" }),
    ).toEqual({ int: 1, con: 1 });
  });

  it("is null when incomplete or repeated", () => {
    expect(improvementBonuses({ mode: "plus-two", ability: null })).toBeNull();
    expect(
      improvementBonuses({ mode: "one-one", first: "int", second: "int" }),
    ).toBeNull();
  });
});

describe("levelUpErrors", () => {
  it("asks for a subclass at level 3", () => {
    const character = wizardAt(2);
    const plan = planFor(character);
    expect(
      levelUpErrors(
        character,
        plan,
        { ...emptyLevelUpDraft(), ...firstSpells(plan) },
        index,
      ),
    ).toEqual({ subclass: "Elegí una subclase." });
  });

  it("asks for the improvement at level 4", () => {
    const character = wizardAt(3);
    const plan = planFor(character);
    expect(
      levelUpErrors(
        character,
        plan,
        { ...emptyLevelUpDraft(), ...firstSpells(plan) },
        index,
      ),
    ).toEqual({ improvement: "Elegí qué característica sube." });
  });

  // SRD 5.2.1, "Mejora de característica": no puede pasar de 20.
  it("does not let a score go above 20", () => {
    const character = wizardAt(3, {
      baseAbilityScores: {
        str: 8,
        dex: 12,
        con: 13,
        int: 17,
        wis: 14,
        cha: 10,
      },
    });
    const plan = planFor(character);
    const draft: LevelUpDraft = {
      ...emptyLevelUpDraft(),
      ...firstSpells(plan),
      improvement: { mode: "plus-two", ability: "int" },
    };
    // Int 17 + 2 del trasfondo = 19; +2 llegaría a 21.
    expect(levelUpErrors(character, plan, draft, index)).toEqual({
      improvement: "Ninguna característica puede pasar de 20.",
    });
  });
});

describe("applyLevelUp", () => {
  it("raises the class level and keeps the play state", () => {
    const character = wizardAt(1, {
      playState: { damageTaken: 3, hitDiceSpent: { d6: 1 } },
    });
    const plan = planFor(character);
    const result = applyLevelUp(
      character,
      plan,
      { ...emptyLevelUpDraft(), ...firstSpells(plan) },
      index,
    );
    expect(result.ok && result.character.classes).toEqual([wizardClass(2)]);
    expect(result.ok && result.character.playState.damageTaken).toBe(3);
  });

  it("saves the chosen subclass", () => {
    const character = wizardAt(2);
    const plan = planFor(character);
    const result = applyLevelUp(
      character,
      plan,
      { ...emptyLevelUpDraft(), ...firstSpells(plan), subclassId: "evoker" },
      index,
    );
    expect(result.ok && result.character.classes).toMatchObject([
      { classId: "wizard", level: 3, subclassId: "evoker" },
    ]);
  });

  it("saves the improvement as a choice the engine applies", () => {
    const character = wizardAt(3, {
      classes: [wizardClass(3, "evoker")],
    });
    const plan = planFor(character);
    const result = applyLevelUp(
      character,
      plan,
      {
        ...emptyLevelUpDraft(),
        ...firstSpells(plan),
        improvement: { mode: "plus-two", ability: "int" },
      },
      index,
    );
    if (!result.ok) throw new Error("debería subir");
    const sheet = calculateSheet(result.character, index);
    expect(sheet.issues).toEqual([]);
    expect(sheet.abilities.int.score).toBe(19);
    expect(result.character.classes[0]?.subclassId).toBe("evoker");
  });

  it("returns the errors instead of a character", () => {
    const character = wizardAt(2);
    expect(
      applyLevelUp(character, planFor(character), emptyLevelUpDraft(), index),
    ).toEqual({
      ok: false,
      errors: {
        subclass: "Elegí una subclase.",
        spells: "Elegí 2 conjuros nuevos para el libro (llevás 0).",
      },
    });
  });
});

describe("hitPointGain", () => {
  // SRD 5.2.1, tabla "Puntos de golpe establecidos por clase": mago 4 + Con.
  it("is the fixed value plus the Con modifier", () => {
    const character = wizardAt(1);
    expect(
      hitPointGain(character, planFor(character), emptyLevelUpDraft(), index),
    ).toBe(4 + 2);
  });

  // La Constitución más alta sube los PG de todos los niveles: de 14 (+2) a
  // 16 (+3) suma 1 PG en cada uno de los 4 niveles, además de los 4 + 3.
  it("includes a Constitution improvement", () => {
    const character = wizardAt(3, {
      classes: [wizardClass(3, "evoker")],
    });
    const draft: LevelUpDraft = {
      ...emptyLevelUpDraft(),
      improvement: { mode: "plus-two", ability: "con" },
    };
    expect(hitPointGain(character, planFor(character), draft, index)).toBe(
      4 + 3 + 3,
    );
  });
});

// SRD 5.2.1, mago, "Libro de conjuros": "cada vez que ganes un nivel de mago
// después del 1, añade dos conjuros de mago [...] de un nivel para el que
// tengas espacios de conjuro". Tabla "Rasgos de mago": 4 trucos en el nivel 4.
describe("level up: wizard spells (ADR 0021)", () => {
  it("asks for two spells for the book at level 2", () => {
    const { spells } = planFor(wizardAt(1));
    expect(spells?.cantrips.count).toBe(0);
    expect(spells?.spellbook.count).toBe(2);
    expect(spells?.maxSpellLevel).toBe(1);
    // Solo de nivel 1 y que todavía no estén en el libro.
    expect(spells?.spellbook.options.every((s) => s.data.level === 1)).toBe(
      true,
    );
    expect(spells?.spellbook.options).toHaveLength(30 - 6);
  });

  it("offers level 2 spells at level 3", () => {
    const { spells } = planFor(wizardAt(2));
    expect(spells?.maxSpellLevel).toBe(2);
    expect(spells?.spellbook.options.some((s) => s.id === "misty-step")).toBe(
      true,
    );
    expect(spells?.spellbook.options.some((s) => s.id === "fireball")).toBe(
      false,
    );
  });

  it("asks for one more cantrip at level 4 and level 3 spells at 5", () => {
    expect(planFor(wizardAt(3)).spells).toMatchObject({
      cantrips: { count: 1 },
      spellbook: { count: 2 },
      prepared: 7,
    });
    const atFive = planFor(wizardAt(4)).spells;
    expect(atFive?.cantrips.count).toBe(0);
    expect(atFive?.spellbook.options.some((s) => s.id === "fireball")).toBe(
      true,
    );
  });

  it("adds the new spells to the class lists", () => {
    const character = wizardAt(3, { classes: [wizardClass(3, "evoker")] });
    const plan = planFor(character);
    const result = applyLevelUp(
      character,
      plan,
      {
        ...emptyLevelUpDraft(),
        improvement: { mode: "plus-two", ability: "int" },
        cantripIds: ["fire-bolt"],
        spellbookIds: ["misty-step", "shield"],
      },
      index,
    );
    if (!result.ok) throw new Error("debería subir");
    const [entry] = result.character.classes;
    expect(entry?.cantripIds).toEqual([
      "light",
      "mage-hand",
      "ray-of-frost",
      "fire-bolt",
    ]);
    expect(entry?.spellbookIds?.slice(-2)).toEqual(["misty-step", "shield"]);
    expect(calculateSheet(result.character, index).issues).toEqual([]);
  });

  it("rejects a spell already in the book", () => {
    const character = wizardAt(1);
    const plan = planFor(character);
    const draft = {
      ...emptyLevelUpDraft(),
      spellbookIds: [LEVEL_1_SPELLS[0] ?? "", "shield"],
    };
    expect(levelUpErrors(character, plan, draft, index).spells).toBe(
      "Hay conjuros nuevos para el libro que no se pueden elegir.",
    );
  });

  // Un mago creado antes de que existieran los conjuros completa sus listas
  // al subir de nivel.
  it("fills the lists of a wizard saved before spells existed", () => {
    const character = wizardAt(1, {
      classes: [{ classId: "wizard", level: 1 }],
    });
    const { spells } = planFor(character);
    expect(spells?.cantrips.count).toBe(3);
    expect(spells?.spellbook.count).toBe(8);
  });

  it("asks for no spells when leveling a fighter", () => {
    const fighter = wizardAt(1, {
      classes: [{ classId: "fighter", level: 1 }],
    });
    expect(planFor(fighter).spells).toBeNull();
  });
});
