import { describe, expect, it } from "vitest";

import { sampleCharacter } from "@/lib/sample-character";
import { srd2024Index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";

// La hoja de demostración usa este personaje: si el contenido o el motor
// cambian y la hoja deja de cuadrar, este test avisa.
describe("sample character: Brunhilda, dwarf fighter 3", () => {
  const sheet = calculateSheet(sampleCharacter, srd2024Index);

  it("has no data issues", () => {
    expect(sheet.issues).toEqual([]);
  });

  // SRD 5.2.1, "Puntos de golpe": guerrero 10 + Con en el nivel 1 y 6 + Con
  // en cada nivel siguiente (Con 14 → +2). Enano, "Aguante enano": +1 por nivel.
  it("has 31 max hit points and 22 current", () => {
    expect(sheet.hitPoints.max).toBe(12 + 8 + 8 + 3);
    expect(sheet.hitPoints.current).toBe(22);
  });

  // SRD 5.2.1, "Cota de malla": CA 16; "Escudo": +2.
  it("has AC 18 and no armor penalties", () => {
    expect(sheet.ac).toBe(18);
    expect(sheet.armorPenalties).toEqual({
      untrainedArmor: false,
      untrainedShield: false,
      insufficientStrength: false,
    });
  });

  // Soldado: Atletismo e Intimidación; guerrero: Percepción y Supervivencia.
  it("is proficient in four skills", () => {
    const proficient = Object.entries(sheet.skills)
      .filter(([, s]) => s.proficiency === "proficient")
      .map(([skill]) => skill);
    expect(proficient.sort()).toEqual(
      ["athletics", "intimidation", "perception", "survival"].sort(),
    );
  });
});
