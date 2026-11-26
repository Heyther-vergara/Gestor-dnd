// ADR 0027 (SOC 2 PI1.3 · ISO 27001 A.8.26): la hoja avisa cuando el motor no
// pudo aplicar algo, en vez de mostrar números incorrectos en silencio.
import { describe, expect, it } from "vitest";

import { buildCharacter, emptyDraft } from "@/lib/character-builder";
import { withHomebrew } from "@/lib/homebrew";
import { hasSheetIssues, summarizeSheetIssues } from "@/lib/sheet-issues";
import { srd2024Index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";

import { parsedTinkerer } from "./homebrew-class-fixture";

describe("summarizeSheetIssues", () => {
  it("separates missing content and explains its type", () => {
    const summary = summarizeSheetIssues([
      'No se encontró class "alchemist"',
      'No se encontró item "ring-of-luck"',
    ]);
    expect(summary.missing).toEqual([
      { type: "class", id: "alchemist", label: "clase" },
      { type: "item", id: "ring-of-luck", label: "objeto" },
    ]);
    expect(summary.other).toEqual([]);
  });

  it("separates content from an inactive package", () => {
    expect(
      summarizeSheetIssues([
        '"ring-of-luck" es del paquete "homebrew-abc123", que no está activo',
      ]).inactive,
    ).toEqual([{ id: "ring-of-luck", packageId: "homebrew-abc123" }]);
  });

  it("keeps any other issue as the engine wrote it, once", () => {
    const issue = "Hay 2 armaduras equipadas; solo se puede llevar una";
    const summary = summarizeSheetIssues([issue, issue]);
    expect(summary.other).toEqual([issue]);
    expect(hasSheetIssues(summary)).toBe(true);
  });

  it("has nothing to show for a clean sheet", () => {
    expect(hasSheetIssues(summarizeSheetIssues([]))).toBe(false);
  });
});

// El caso de la auditoría: la clase homebrew vive en el navegador donde se
// importó (ADR 0020). En otro navegador, el motor no la encuentra.
describe("a homebrew class opened in another browser", () => {
  const withTinkerer = withHomebrew(srd2024Index, parsedTinkerer());
  const result = buildCharacter(
    {
      ...emptyDraft(),
      name: "Ada",
      speciesId: "human",
      size: "medium",
      classId: "tinkerer",
      classSkills: ["arcana", "investigation"],
      backgroundId: "sage",
      abilityBonus: { mode: "two-one", plusTwo: "int", plusOne: "con" },
      baseAbilityScores: {
        str: 8,
        dex: 14,
        con: 13,
        int: 15,
        wis: 12,
        cha: 10,
      },
      backgroundEquipment: { option: 1, picks: [] },
    },
    withTinkerer,
    "ada",
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const character = result.character;

  it("has no issues where the class was imported", () => {
    const summary = summarizeSheetIssues(
      calculateSheet(character, withTinkerer).issues,
    );
    expect(hasSheetIssues(summary)).toBe(false);
  });

  it("reports the missing class where it was not imported", () => {
    const summary = summarizeSheetIssues(
      calculateSheet(character, srd2024Index).issues,
    );
    expect(summary.missing).toContainEqual({
      type: "class",
      id: "tinkerer",
      label: "clase",
    });
  });
});
