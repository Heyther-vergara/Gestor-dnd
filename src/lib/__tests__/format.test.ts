import { describe, expect, it } from "vitest";

import {
  characterSubtitle,
  coinsText,
  equipmentOptionText,
  feetToMeters,
  formatModifier,
} from "@/lib/format";
import { sampleCharacter } from "@/lib/sample-character";
import { srd2024Index } from "@/lib/srd-2024";

describe("formatModifier", () => {
  it("adds a plus sign to zero and positives", () => {
    expect(formatModifier(0)).toBe("+0");
    expect(formatModifier(3)).toBe("+3");
  });

  it("uses a typographic minus for negatives", () => {
    expect(formatModifier(-1)).toBe("−1");
  });
});

// SRD 5.2.1 (español): velocidad 9 m (30 pies), visión en la oscuridad 36 m
// (120 pies) y la penalización de armadura de 3 m (10 pies).
describe("feetToMeters", () => {
  it("converts like the Spanish SRD", () => {
    expect(feetToMeters(30)).toBe("9 m");
    expect(feetToMeters(120)).toBe("36 m");
    expect(feetToMeters(10)).toBe("3 m");
  });

  it("uses a decimal comma", () => {
    expect(feetToMeters(25)).toBe("7,5 m");
  });
});

describe("characterSubtitle", () => {
  // SRD 5.2.1 (español): Enano, Guerrero, Soldado.
  it("names species, classes with level and background in Spanish", () => {
    expect(characterSubtitle(sampleCharacter, srd2024Index)).toBe(
      "Enano · Guerrero 3 · Soldado",
    );
  });

  // SRD 5.2.1 (español), "Subclase de guerrero: Campeón".
  it("adds the subclass after the class", () => {
    expect(
      characterSubtitle(
        {
          ...sampleCharacter,
          classes: [{ classId: "fighter", level: 3, subclassId: "champion" }],
        },
        srd2024Index,
      ),
    ).toBe("Enano · Guerrero 3 (Campeón) · Soldado");
  });

  it("falls back to the id when the content is missing", () => {
    expect(
      characterSubtitle(
        { ...sampleCharacter, backgroundId: "unknown-bg" },
        srd2024Index,
      ),
    ).toBe("Enano · Guerrero 3 · unknown-bg");
  });
});

describe("equipmentOptionText", () => {
  // SRD 5.2.1, Guerrero (A): "cota de malla, espadón, mangual, 8 jabalinas,
  // paquete de explorador de mazmorras y 4 po".
  it("lists the items with quantities and the gold", () => {
    const fighter = srd2024Index.get("fighter");
    if (fighter?.type !== "class") throw new Error("expected a class");
    const [a, , c] = fighter.data.startingEquipment;
    if (!a || !c) throw new Error("expected options A and C");
    expect(equipmentOptionText(a, srd2024Index)).toBe(
      "Cota de malla, Espadón, Mangual, Jabalina ×8, Paquete de explorador de mazmorras y 4 po",
    );
    expect(equipmentOptionText(c, srd2024Index)).toBe("155 po");
  });

  it("shows an entry with several items as a choice", () => {
    expect(
      equipmentOptionText(
        { items: [{ itemIds: ["dice", "playing-cards"], quantity: 1 }], gp: 0 },
        srd2024Index,
      ),
    ).toBe("Dados / Naipes");
  });
});

describe("coinsText", () => {
  // SRD 5.2.1, "Monedas": pc, pp, pe, po y ppt.
  it("shows only the coins the character has, highest first", () => {
    expect(coinsText({ cp: 3, sp: 0, ep: 0, gp: 18, pp: 1 })).toBe(
      "1 ppt, 18 po, 3 pc",
    );
    expect(coinsText({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 })).toBe("");
  });
});
