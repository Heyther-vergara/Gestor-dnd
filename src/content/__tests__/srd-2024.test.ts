import { describe, expect, it } from "vitest";

import backgrounds from "@/content/srd-2024/backgrounds.json";
import classes from "@/content/srd-2024/classes.json";
import feats from "@/content/srd-2024/feats.json";
import items from "@/content/srd-2024/items.json";
import manifest from "@/content/srd-2024/manifest.json";
import species from "@/content/srd-2024/species.json";
import spells from "@/content/srd-2024/spells.json";
import { contentSchema, packageSchema } from "@/rules-engine/schemas";

// Criterio de la fase 1: todo el JSON del paquete valida contra los esquemas.

const files = { classes, species, backgrounds, feats, spells, items };
const allContent = Object.values(files).flat();

describe("SRD 2024 package", () => {
  it("has a valid manifest", () => {
    expect(packageSchema.parse(manifest).id).toBe("srd-2024");
  });

  it.each(Object.entries(files))(
    "%s.json validates against contentSchema",
    (_, items) => {
      for (const item of items) {
        const result = contentSchema.safeParse(item);
        // Si falla, el mensaje dice qué contenido y qué campo.
        expect(result.error?.issues ?? [], `id: ${item.id}`).toEqual([]);
      }
    },
  );

  it("only contains content of the matching type in each file", () => {
    const expectedType = {
      classes: "class",
      species: "species",
      backgrounds: "background",
      feats: "feat",
      spells: "spell",
      items: "item",
    };
    for (const [file, items] of Object.entries(files)) {
      for (const item of items) {
        expect(item.type, `${file}.json → ${item.id}`).toBe(
          expectedType[file as keyof typeof expectedType],
        );
      }
    }
  });

  it("belongs to the srd-2024 package", () => {
    for (const item of allContent) {
      expect(item.packageId, item.id).toBe(manifest.id);
    }
  });

  it("has unique ids", () => {
    const ids = allContent.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the phase 1 subset", () => {
    expect(classes).toHaveLength(2);
    expect(species).toHaveLength(3);
    expect(backgrounds).toHaveLength(3);
    expect(spells).toHaveLength(20);
  });

  it("references feats that exist in the package", () => {
    const featIds = new Set(feats.map((feat) => feat.id));
    for (const background of backgrounds) {
      expect(featIds, `${background.id} → ${background.data.featId}`).toContain(
        background.data.featId,
      );
    }
  });

  it("keeps SRD rules that 5e-bits gets wrong", () => {
    // SRD 5.2.1: el humano es Mediano o Pequeño.
    const human = species.find((s) => s.id === "human");
    expect(human?.data.size).toEqual(["medium", "small"]);

    // SRD 5.2.1, tabla "Armas": honda 1d4 contundente (5e-bits dice perforante).
    expect(weapon("sling")?.damage).toEqual({
      dice: "1d4",
      type: "bludgeoning",
    });
    // Tridente 1d8 perforante, versátil (1d10) (5e-bits dice 1d6 / 1d8).
    expect(weapon("trident")?.damage).toEqual({
      dice: "1d8",
      type: "piercing",
    });
    expect(weapon("trident")?.versatileDice).toBe("1d10");
  });

  // SRD 5.2.1, enano: "Tienes visión en la oscuridad hasta 36 m". Tiene que ser
  // una base: con "max" sería un techo y el motor daría 0 (ADR 0006).
  it("gives the dwarf darkvision as a base value", () => {
    const dwarf = species.find((s) => s.id === "dwarf");
    const effects = dwarf?.data.traits.flatMap((t) => t.effects);
    expect(effects).toContainEqual({
      target: "senses.darkvision",
      op: "base",
      value: 120,
    });
  });
});

const byCategory = (category: string) =>
  items.filter((item) => item.data.category === category);

function weapon(id: string) {
  const item = contentSchema.parse(items.find((i) => i.id === id));
  return item.type === "item" ? item.data.weapon : undefined;
}

describe("SRD 2024 items", () => {
  // SRD 5.2.1, tablas "Armaduras" y "Armas": 12 armaduras, el escudo y 38 armas.
  it("includes every armor, the shield and every weapon", () => {
    expect(byCategory("armor")).toHaveLength(12);
    expect(byCategory("shield")).toHaveLength(1);
    expect(byCategory("weapon")).toHaveLength(38);
  });

  // ADR 0003: la CA de cada armadura es un único efecto "base".
  // SRD 5.2.1, "Armaduras": cuero 11 + Des · cota de escamas 14 + Des (máx. 2)
  // · cota de malla 16 (Fue 13) · placas 18 (Fue 15).
  it.each([
    ["leather-armor", { value: 11, abilities: ["dex"] }],
    ["scale-mail", { value: 14, abilities: ["dex"], maxAbilityBonus: 2 }],
    ["chain-mail", { value: 16 }],
    ["plate-armor", { value: 18 }],
  ])("%s has the SRD base AC", (id, expected) => {
    const item = items.find((i) => i.id === id);
    expect(item?.effects).toEqual([{ target: "ac", op: "base", ...expected }]);
  });

  it("keeps the strength requirement and stealth disadvantage", () => {
    const chainMail = items.find((i) => i.id === "chain-mail");
    expect(chainMail?.data.armor).toEqual({
      armorCategory: "heavy",
      strengthRequirement: 13,
      stealthDisadvantage: true,
    });
  });

  // SRD 5.2.1, "Armaduras": escudo +2.
  it("gives the shield +2 AC", () => {
    const shield = items.find((i) => i.id === "shield-item");
    expect(shield?.effects).toEqual([{ target: "ac", op: "add", value: 2 }]);
  });
});
