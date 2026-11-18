import { HOMEBREW_CLASS_FORMAT, parseClassFile } from "@/lib/homebrew-class";
import { srd2024Index } from "@/lib/srd-2024";

// Clase de prueba inventada ("Inventor"). El Alquimista real es contenido de
// terceros y no va en el repositorio (ADR 0020).
export const PACKAGE_ID = "homebrew-abc123";

export const tinkererFile = {
  format: HOMEBREW_CLASS_FORMAT,
  version: 1,
  class: {
    id: "tinkerer",
    type: "class",
    name: "Inventor",
    description: "Arma cosas.",
    data: {
      hitDie: 8,
      primaryAbilities: ["int"],
      savingThrows: ["int", "con"],
      skillChoices: { count: 2, options: ["arcana", "investigation"] },
      armorProficiencies: ["light"],
      weaponProficiencies: ["simple"],
      toolProficiencies: ["Herramientas de hojalatero"],
      resources: [
        {
          id: "gear-points",
          name: "Puntos de engranaje",
          maxByLevel: [3, 4],
          recharge: "long-rest",
        },
      ],
      saveDcs: [{ name: "CD de Inventos", ability: "int" }],
      features: [
        { level: 1, name: "Engranajes", description: "" },
        {
          level: 3,
          name: "Especialidad",
          description: "",
          grants: "subclass",
        },
      ],
      startingEquipment: [],
    },
  },
  subclasses: [
    {
      id: "clockmaker",
      type: "subclass",
      name: "Relojero",
      description: "",
      data: {
        classId: "tinkerer",
        features: [
          {
            level: 3,
            name: "Piel de bronce",
            description: "",
            effects: [{ target: "resistance.fire", op: "grant" }],
          },
        ],
      },
    },
  ],
};

// La clase y la subclase ya importadas, listas para el índice del motor.
export function parsedTinkerer() {
  const result = parseClassFile(
    JSON.stringify(tinkererFile),
    PACKAGE_ID,
    srd2024Index,
  );
  if (!result.ok) throw new Error(result.errors.join(" "));
  return [result.parsed.cls, ...result.parsed.subclasses];
}
