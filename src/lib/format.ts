// Textos de la hoja: nombres en español y formato de números.

import type { ContentIndex } from "@/rules-engine/engine";
import type {
  Ability,
  Character,
  Coins,
  DamageType,
  InventoryItem,
  Skill,
  StartingEquipmentOption,
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
  champion: "Campeón",
  evoker: "Evocador",
  dwarf: "Enano",
  human: "Humano",
  halfling: "Mediano",
  acolyte: "Acólito",
  sage: "Erudito",
  soldier: "Soldado",
  // Objetos del equipo inicial (ADR 0017). SRD 5.2.1 (español): "Equipo
  // inicial" de cada clase y trasfondo, tablas "Armas", "Armaduras",
  // "Equipo de aventurero" y "Herramientas".
  "chain-mail": "Cota de malla",
  "studded-leather-armor": "Armadura de cuero tachonado",
  "shield-item": "Escudo",
  greatsword: "Espadón",
  flail: "Mangual",
  javelin: "Jabalina",
  scimitar: "Cimitarra",
  shortsword: "Espada corta",
  longbow: "Arco largo",
  shortbow: "Arco corto",
  spear: "Lanza",
  dagger: "Daga",
  quarterstaff: "Bastón",
  arrows: "Flechas",
  quiver: "Aljaba",
  "dungeoneer-pack": "Paquete de explorador de mazmorras",
  "scholars-pack": "Paquete de erudito",
  spellbook: "Libro de conjuros",
  book: "Libro",
  parchment: "Pergamino (hojas)",
  robe: "Túnica",
  "calligraphers-supplies": "Suministros de calígrafo",
  "healers-kit": "Útiles de sanador",
  "clothes-travelers": "Ropas de viaje",
  amulet: "Amuleto (símbolo sagrado)",
  emblem: "Emblema (símbolo sagrado)",
  reliquary: "Relicario (símbolo sagrado)",
  dragonchess: "Ajedrez dragón",
  "three-dragon-ante": "Apuesta de los tres dragones",
  dice: "Dados",
  "playing-cards": "Naipes",
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

// "Enano · Guerrero 3 (Campeón) · Soldado": la línea bajo el nombre del personaje.
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
    ...character.classes.map(
      (c) =>
        `${nameOf(c.classId)} ${c.level}` +
        (c.subclassId ? ` (${nameOf(c.subclassId)})` : ""),
    ),
    nameOf(character.backgroundId),
  ].join(" · ");
}

// Nombre en español de un id de contenido, o el id si no está en el paquete.
export function contentNameById(id: string, index: ContentIndex): string {
  const content = index.get(id);
  return content ? contentName(content) : id;
}

// "A, B y C".
function joinList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}`;
}

// "Jabalina ×8": la cantidad solo si es más de uno.
const withQuantity = (name: string, quantity: number) =>
  quantity > 1 ? `${name} ×${quantity}` : name;

// Una opción de equipo inicial en una línea: "Espadón, Jabalina ×8 y 4 po".
// Una entrada con varios objetos se muestra como "Dados / Naipes": con comas
// se confundiría con objetos que vienen todos juntos.
export function equipmentOptionText(
  option: StartingEquipmentOption,
  index: ContentIndex,
): string {
  const parts = option.items.map((entry) =>
    withQuantity(
      entry.itemIds.map((id) => contentNameById(id, index)).join(" / "),
      entry.quantity,
    ),
  );
  if (option.gp > 0) parts.push(`${option.gp} po`);
  return joinList(parts);
}

// "Opción A", "Opción B"…, como en el SRD ("Elige A o B").
export const optionLetter = (i: number): string =>
  String.fromCharCode("A".charCodeAt(0) + i);

// El inventario listo para mostrar, en el orden guardado.
export function inventoryLines(
  inventory: readonly InventoryItem[],
  index: ContentIndex,
) {
  return inventory.map((entry) => ({
    itemId: entry.itemId,
    label: withQuantity(contentNameById(entry.itemId, index), entry.quantity),
    equipped: entry.equipped,
  }));
}

// SRD 5.2.1, "Monedas": abreviaturas en español, de mayor a menor valor.
const coinAbbreviations: [keyof Coins, string][] = [
  ["pp", "ppt"],
  ["gp", "po"],
  ["ep", "pe"],
  ["sp", "pp"],
  ["cp", "pc"],
];

// "18 po, 5 pp". Vacío si no tiene monedas.
export function coinsText(coins: Coins): string {
  return coinAbbreviations
    .filter(([key]) => coins[key] > 0)
    .map(([key, abbreviation]) => `${coins[key]} ${abbreviation}`)
    .join(", ");
}
