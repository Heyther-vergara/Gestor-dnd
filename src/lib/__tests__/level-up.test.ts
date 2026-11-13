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
    classes: [{ classId: "wizard", level }],
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
      classes: [
        { classId: "wizard", level: 2 },
        { classId: "fighter", level: 1 },
      ],
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
    expect(
      levelUpErrors(character, planFor(character), emptyLevelUpDraft(), index),
    ).toEqual({ subclass: "Elegí una subclase." });
  });

  it("asks for the improvement at level 4", () => {
    const character = wizardAt(3);
    expect(
      levelUpErrors(character, planFor(character), emptyLevelUpDraft(), index),
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
    const draft: LevelUpDraft = {
      subclassId: null,
      improvement: { mode: "plus-two", ability: "int" },
    };
    // Int 17 + 2 del trasfondo = 19; +2 llegaría a 21.
    expect(levelUpErrors(character, planFor(character), draft, index)).toEqual({
      improvement: "Ninguna característica puede pasar de 20.",
    });
  });
});

describe("applyLevelUp", () => {
  it("raises the class level and keeps the play state", () => {
    const character = wizardAt(1, {
      playState: { damageTaken: 3, hitDiceSpent: { d6: 1 } },
    });
    const result = applyLevelUp(
      character,
      planFor(character),
      emptyLevelUpDraft(),
      index,
    );
    expect(result.ok && result.character.classes).toEqual([
      { classId: "wizard", level: 2 },
    ]);
    expect(result.ok && result.character.playState.damageTaken).toBe(3);
  });

  it("saves the chosen subclass", () => {
    const character = wizardAt(2);
    const result = applyLevelUp(
      character,
      planFor(character),
      { ...emptyLevelUpDraft(), subclassId: "evoker" },
      index,
    );
    expect(result.ok && result.character.classes).toEqual([
      { classId: "wizard", level: 3, subclassId: "evoker" },
    ]);
  });

  it("saves the improvement as a choice the engine applies", () => {
    const character = wizardAt(3, {
      classes: [{ classId: "wizard", level: 3, subclassId: "evoker" }],
    });
    const result = applyLevelUp(
      character,
      planFor(character),
      {
        subclassId: null,
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
    ).toEqual({ ok: false, errors: { subclass: "Elegí una subclase." } });
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
      classes: [{ classId: "wizard", level: 3, subclassId: "evoker" }],
    });
    const draft: LevelUpDraft = {
      subclassId: null,
      improvement: { mode: "plus-two", ability: "con" },
    };
    expect(hitPointGain(character, planFor(character), draft, index)).toBe(
      4 + 3 + 3,
    );
  });
});
