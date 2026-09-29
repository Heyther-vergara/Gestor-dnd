import { describe, expect, it } from "vitest";

import backgrounds from "@/content/srd-2024/backgrounds.json";
import classes from "@/content/srd-2024/classes.json";
import feats from "@/content/srd-2024/feats.json";
import manifest from "@/content/srd-2024/manifest.json";
import species from "@/content/srd-2024/species.json";
import spells from "@/content/srd-2024/spells.json";
import { contentSchema, packageSchema } from "@/rules-engine/schemas";

// Criterio de la fase 1: todo el JSON del paquete valida contra los esquemas.

const files = { classes, species, backgrounds, feats, spells };
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
  });
});
