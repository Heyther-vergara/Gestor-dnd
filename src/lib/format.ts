// Textos de la hoja: nombres en español y formato de números.

import type { ContentIndex } from "@/rules-engine/engine";
import type {
  Ability,
  Character,
  DamageType,
  Skill,
} from "@/rules-engine/schemas";

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

// SRD 5.2.1 (español), glosario, tabla "Tipos de daño". Se usa tras "daño
// de…" o "resistencia al…", por eso va en minúscula y con artículo aparte.
export const damageTypeNames: Record<DamageType, string> = {
  acid: "ácido",
  bludgeoning: "contundente",
  slashing: "cortante",
  cold: "frío",
  fire: "fuego",
  force: "fuerza",
  necrotic: "necrótico",
  piercing: "perforante",
  psychic: "psíquico",
  radiant: "radiante",
  lightning: "relámpago",
  thunder: "trueno",
  poison: "veneno",
};

// Bonificadores con signo: +3, +0, −1 (signo menos tipográfico, no guion).
export const formatModifier = (value: number): string =>
  value < 0 ? `−${Math.abs(value)}` : `+${value}`;

// El SRD en español convierte 5 pies en 1,5 m (30 pies = 9 m).
export const feetToMeters = (feet: number): string =>
  `${((feet / 5) * 1.5).toLocaleString("es", { maximumFractionDigits: 1 })} m`;

// SRD 5.2.1 (español): nombres de clases, especies y trasfondos del paquete.
// El contenido importado está en inglés; si falta uno, se usa ese nombre.
const contentNamesEs: Record<string, string> = {
  fighter: "Guerrero",
  wizard: "Mago",
  dwarf: "Enano",
  human: "Humano",
  halfling: "Mediano",
  acolyte: "Acólito",
  sage: "Erudito",
  soldier: "Soldado",
};

export const contentName = (content: { id: string; name: string }): string =>
  contentNamesEs[content.id] ?? content.name;

// SRD 5.2.1 (español), "Tamaño" en cada especie.
export const sizeNames: Record<"tiny" | "small" | "medium" | "large", string> =
  {
    tiny: "Diminuto",
    small: "Pequeño",
    medium: "Mediano",
    large: "Grande",
  };

// "Enano · Guerrero 3 · Soldado": la línea bajo el nombre del personaje.
export function characterSubtitle(
  character: Pick<Character, "speciesId" | "classes" | "backgroundId">,
  index: ContentIndex,
): string {
  const nameOf = (id: string) => {
    const content = index.get(id);
    return content ? contentName(content) : id;
  };
  return [
    nameOf(character.speciesId),
    ...character.classes.map((c) => `${nameOf(c.classId)} ${c.level}`),
    nameOf(character.backgroundId),
  ].join(" · ");
}
