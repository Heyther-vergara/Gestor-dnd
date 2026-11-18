import { describe, expect, it } from "vitest";

import {
  buildCharacter,
  builderOptions,
  type CharacterDraft,
  emptyDraft,
} from "@/lib/character-builder";
import { withHomebrew } from "@/lib/homebrew";
import { applyLevelUp, emptyLevelUpDraft, planLevelUp } from "@/lib/level-up";
import { createPlayReducer, type PlaySession } from "@/lib/play-reducer";
import { srd2024Index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";
import type { Character } from "@/rules-engine/schemas";

import { PACKAGE_ID, parsedTinkerer } from "./homebrew-class-fixture";

// Una clase homebrew importada se usa como las del SRD (ADR 0020): se elige
// en el creador, sube de nivel y elige subclase.

const index = withHomebrew(srd2024Index, parsedTinkerer());

// Inventora humana erudita, con el conjunto estándar: Int 15 + 2 = 17 (+3).
function tinkererDraft(): CharacterDraft {
  return {
    ...emptyDraft(),
    name: "Ada",
    speciesId: "human",
    size: "medium",
    classId: "tinkerer",
    classSkills: ["arcana", "investigation"],
    backgroundId: "sage",
    abilityBonus: { mode: "two-one", plusTwo: "int", plusOne: "con" },
    baseAbilityScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
    // La clase homebrew no da equipo; el erudito, sí: B es solo oro.
    backgroundEquipment: { option: 1, picks: [] },
  };
}

function created(): Character {
  const result = buildCharacter(tinkererDraft(), index, "ada");
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.character;
}

function levelUp(character: Character, subclassId?: string): Character {
  const check = planLevelUp(character, index);
  if (!check.ok) throw new Error(check.reason);
  const result = applyLevelUp(
    character,
    check.plan,
    { ...emptyLevelUpDraft(), subclassId: subclassId ?? null },
    index,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.character;
}

describe("a homebrew class in the creator", () => {
  it("is offered after the SRD classes", () => {
    const ids = builderOptions(index).classes.map((c) => c.id);
    expect(ids.at(-1)).toBe("tinkerer");
  });

  it("activates the homebrew package so the engine uses the class", () => {
    const character = created();
    expect(character.activePackageIds).toEqual(["srd-2024", PACKAGE_ID]);
    const sheet = calculateSheet(character, index);
    expect(sheet.issues).toEqual([]);
    // d8: 8 + Con (13 + 1 = 14 → +2) = 10 PG.
    expect(sheet.hitPoints.max).toBe(10);
    expect(sheet.resources[0]).toMatchObject({ max: 3, remaining: 3 });
    // 8 + 2 + 3.
    expect(sheet.saveDcs[0]?.value).toBe(13);
  });
});

describe("a homebrew class leveling up", () => {
  it("offers its own subclasses at the level the class says", () => {
    const level2 = levelUp(created());
    const check = planLevelUp(level2, index);
    expect(check.ok && check.plan.subclassOptions.map((s) => s.id)).toEqual([
      "clockmaker",
    ]);
  });

  it("applies the subclass features", () => {
    const level3 = levelUp(levelUp(created()), "clockmaker");
    const sheet = calculateSheet(level3, index);
    expect(sheet.issues).toEqual([]);
    expect(sheet.damageDefenses.resistances).toEqual(["fire"]);
    // La tabla de recursos llega al nivel 2 (4): en el 3 sigue en 4.
    expect(sheet.resources[0]?.max).toBe(4);
  });
});

describe("class resources in play", () => {
  const reducer = createPlayReducer(index);

  it("spends points and recovers them with a long rest", () => {
    let session: PlaySession = { character: created(), message: null };
    session = reducer(session, {
      type: "spend-resource",
      resourceId: "gear-points",
      amount: 2,
    });
    expect(session.message?.text).toBe(
      "Gastaste 2 de Puntos de engranaje. Te queda 1.",
    );
    session = reducer(session, { type: "long-rest" });
    expect(session.message?.text).toBe(
      "Descanso largo: PG, dados de golpe y recursos de clase al máximo.",
    );
    expect(session.character.playState.resourcesSpent).toEqual({});
  });

  it("explains why points can't be spent", () => {
    const session = reducer(
      { character: created(), message: null },
      { type: "spend-resource", resourceId: "gear-points", amount: 4 },
    );
    expect(session.message).toEqual({
      tone: "danger",
      text: "Puntos de engranaje: te quedan 3",
    });
  });
});
