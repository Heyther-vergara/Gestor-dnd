// Textos de la hoja: nombres en español y formato de números.

import type { Ability, Skill } from "@/rules-engine/schemas";

// SRD 5.2.1 (español), "Cómo jugar": nombres de las características.
export const abilityNames: Record<Ability, { name: string; short: string }> = {
  str: { name: "Fuerza", short: "Fue" },
  dex: { name: "Destreza", short: "Des" },
  con: { name: "Constitución", short: "Con" },
  int: { name: "Inteligencia", short: "Int" },
  wis: { name: "Sabiduría", short: "Sab" },
  cha: { name: "Carisma", short: "Car" },
};

// SRD 5.2.1 (español), tabla "Habilidades".
export const skillNames: Record<Skill, string> = {
  acrobatics: "Acrobacias",
  "animal-handling": "Trato con animales",
  arcana: "Arcanos",
  athletics: "Atletismo",
  deception: "Engaño",
  history: "Historia",
  insight: "Perspicacia",
  intimidation: "Intimidación",
  investigation: "Investigación",
  medicine: "Medicina",
  nature: "Naturaleza",
  perception: "Percepción",
  performance: "Interpretación",
  persuasion: "Persuasión",
  religion: "Religión",
  "sleight-of-hand": "Juego de manos",
  stealth: "Sigilo",
  survival: "Supervivencia",
};

// Bonificadores con signo: +3, +0, −1 (signo menos tipográfico, no guion).
export const formatModifier = (value: number): string =>
  value < 0 ? `−${Math.abs(value)}` : `+${value}`;

// El SRD en español convierte 5 pies en 1,5 m (30 pies = 9 m).
export const feetToMeters = (feet: number): string =>
  `${((feet / 5) * 1.5).toLocaleString("es", { maximumFractionDigits: 1 })} m`;
