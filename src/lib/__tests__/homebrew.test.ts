import { describe, expect, it } from "vitest";

import {
  buildHomebrewItem,
  draftFromHomebrewItem,
  emptyHomebrewItemDraft,
  giveItem,
  type HomebrewItem,
  type HomebrewItemDraft,
  homebrewItemErrors,
  homebrewItemId,
  homebrewItemSummary,
  takeItem,
  withHomebrew,
} from "@/lib/homebrew";
import { sampleCharacter } from "@/lib/sample-character";
import { srd2024Index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";

const PACKAGE_ID = "homebrew-test";

function build(draft: Partial<HomebrewItemDraft>, id = "item-test") {
  const result = buildHomebrewItem(
    { ...emptyHomebrewItemDraft, ...draft },
    PACKAGE_ID,
    id,
  );
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.item;
}

// El ejemplo del MVP: un anillo que da +1 a la CA.
const ringOfAc = build(
  { name: "Anillo de protección", bonuses: [{ target: "ac", value: 1 }] },
  "anillo-de-proteccion-abc123",
);

const sheetWith = (items: HomebrewItem[], character = sampleCharacter) =>
  calculateSheet(character, withHomebrew(srd2024Index, items));

describe("homebrew item draft", () => {
  it("needs a name", () => {
    expect(homebrewItemErrors(emptyHomebrewItemDraft)).toContain(
      "Pon un nombre.",
    );
    expect(
      homebrewItemErrors({ ...emptyHomebrewItemDraft, name: "   " }),
    ).toContain("Pon un nombre.");
  });

  it("rejects a zero, decimal or huge bonus", () => {
    for (const value of [0, 1.5, 11, -11]) {
      expect(
        homebrewItemErrors({
          ...emptyHomebrewItemDraft,
          name: "Anillo",
          bonuses: [{ target: "ac", value }],
        }),
      ).toHaveLength(1);
    }
  });

  it("accepts a penalty (a cursed item)", () => {
    expect(
      homebrewItemErrors({
        ...emptyHomebrewItemDraft,
        name: "Anillo maldito",
        bonuses: [{ target: "ac", value: -2 }],
      }),
    ).toEqual([]);
  });

  it("rejects two bonuses to the same thing, also through 'all saves'", () => {
    const twice = (targets: HomebrewItemDraft["bonuses"]) =>
      homebrewItemErrors({
        ...emptyHomebrewItemDraft,
        name: "Capa",
        bonuses: targets,
      });
    expect(
      twice([
        { target: "ac", value: 1 },
        { target: "ac", value: 2 },
      ]),
    ).toHaveLength(1);
    expect(
      twice([
        { target: "save.all", value: 1 },
        { target: "save.dex", value: 1 },
      ]),
    ).toHaveLength(1);
  });
});

describe("buildHomebrewItem", () => {
  it("builds valid item content with an 'add' effect", () => {
    expect(ringOfAc).toMatchObject({
      id: "anillo-de-proteccion-abc123",
      packageId: PACKAGE_ID,
      type: "item",
      name: "Anillo de protección",
      effects: [{ target: "ac", op: "add", value: 1 }],
      data: { category: "magic", requiresAttunement: false },
    });
  });

  it("turns 'all saves' into six effects and resistances into grants", () => {
    const cloak = build({
      name: "Capa ignífuga",
      bonuses: [{ target: "save.all", value: 1 }],
      resistances: ["fire"],
    });
    expect(cloak.effects).toHaveLength(7);
    expect(cloak.effects).toContainEqual({
      target: "save.wis",
      op: "add",
      value: 1,
    });
    expect(cloak.effects).toContainEqual({
      target: "resistance.fire",
      op: "grant",
    });
  });

  it("returns the form errors instead of an item", () => {
    const result = buildHomebrewItem(emptyHomebrewItemDraft, PACKAGE_ID, "x");
    expect(result.ok).toBe(false);
  });

  it("round-trips through the edit draft", () => {
    const draft: HomebrewItemDraft = {
      name: "Capa del zorro",
      description: "Huele a bosque.",
      requiresAttunement: true,
      bonuses: [
        { target: "skill.stealth", value: 2 },
        { target: "save.all", value: 1 },
      ],
      resistances: ["cold"],
    };
    expect(draftFromHomebrewItem(build(draft))).toEqual(draft);
  });

  it("summarizes what the item does in one line", () => {
    expect(homebrewItemSummary(ringOfAc)).toBe("+1 Clase de Armadura");
    expect(
      homebrewItemSummary(
        build({
          name: "Capa",
          requiresAttunement: true,
          bonuses: [{ target: "save.all", value: 1 }],
          resistances: ["fire"],
        }),
      ),
    ).toBe(
      "+1 Todas las salvaciones · Resistencia al fuego · Requiere sintonización",
    );
    expect(homebrewItemSummary(build({ name: "Piedra bonita" }))).toBe(
      "Sin efectos en la hoja",
    );
  });
});

describe("homebrewItemId", () => {
  it("is the name in kebab-case without accents plus the suffix", () => {
    expect(homebrewItemId("Anillo de Protección +1", "abc123")).toBe(
      "anillo-de-proteccion-1-abc123",
    );
  });

  it("falls back to 'objeto' when the name has no letters", () => {
    expect(homebrewItemId("¡¡¡!!!", "abc123")).toBe("objeto-abc123");
  });
});

describe("homebrew items on the sheet", () => {
  // Brunhilda lleva cota de malla (16) y escudo (+2): CA 18.
  it("starts from the sample character's AC", () => {
    expect(sheetWith([]).ac).toBe(18);
  });

  it("adds +1 AC when the ring is given to the character", () => {
    const withRing = giveItem(sampleCharacter, ringOfAc);
    expect(withRing.activePackageIds).toContain(PACKAGE_ID);
    expect(withRing.inventory).toContainEqual({
      itemId: ringOfAc.id,
      quantity: 1,
      equipped: true,
      attuned: false,
    });
    const sheet = sheetWith([ringOfAc], withRing);
    expect(sheet.ac).toBe(19);
    expect(sheet.issues).toEqual([]);
  });

  it("ignores the ring if its homebrew package is not active", () => {
    const withRing = {
      ...giveItem(sampleCharacter, ringOfAc),
      activePackageIds: ["srd-2024"],
    };
    const sheet = sheetWith([ringOfAc], withRing);
    expect(sheet.ac).toBe(18);
    expect(sheet.issues).toHaveLength(1);
  });

  it("ignores an item that needs attunement until it is attuned", () => {
    const ring = build({
      name: "Anillo",
      requiresAttunement: true,
      bonuses: [{ target: "ac", value: 1 }],
    });
    const given = giveItem(sampleCharacter, ring);
    // Dárselo lo deja sintonizado.
    expect(sheetWith([ring], given).ac).toBe(19);
    const notAttuned = {
      ...given,
      inventory: given.inventory.map((entry) => ({ ...entry, attuned: false })),
    };
    expect(sheetWith([ring], notAttuned).ac).toBe(18);
  });

  it("applies saves and resistances", () => {
    const cloak = build({
      name: "Capa",
      bonuses: [{ target: "save.all", value: 1 }],
      resistances: ["fire"],
    });
    const before = sheetWith([]);
    const after = sheetWith([cloak], giveItem(sampleCharacter, cloak));
    expect(after.savingThrows.dex.modifier).toBe(
      before.savingThrows.dex.modifier + 1,
    );
    expect(after.damageDefenses.resistances).toContain("fire");
  });

  it("goes back to normal when the item is taken away", () => {
    const withRing = giveItem(sampleCharacter, ringOfAc);
    const without = takeItem(withRing, ringOfAc.id);
    expect(sheetWith([ringOfAc], without).ac).toBe(18);
  });

  it("does not add the same item twice", () => {
    const once = giveItem(sampleCharacter, ringOfAc);
    expect(giveItem(once, ringOfAc)).toBe(once);
  });

  it("never lets a homebrew item replace SRD content with the same id", () => {
    const fake = { ...ringOfAc, id: "chain-mail" };
    expect(
      withHomebrew(srd2024Index, [fake]).get("chain-mail")?.packageId,
    ).toBe("srd-2024");
  });
});
