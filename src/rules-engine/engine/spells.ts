// Conjuros de una clase (ADR 0021): cuántos trucos, conjuros en el libro y
// conjuros preparados permite cada nivel, y qué conjuros ofrece la lista de
// la clase. Lo usan el motor (para validar al personaje) y el creador y la
// pantalla de subir de nivel (para ofrecer opciones).

import type { Content } from "../schemas";

type ClassContent = Extract<Content, { type: "class" }>;
export type SpellContent = Extract<Content, { type: "spell" }>;

export type SpellLimits = {
  // El nivel de conjuro más alto con espacios en este nivel de clase. 0 si
  // todavía no hay espacios (solo trucos).
  maxSpellLevel: number;
  cantrips: number;
  prepared: number;
  // Conjuros de nivel 1+ que puede tener el libro. null = la clase no usa
  // libro y prepara de su lista entera.
  spellbook: number | null;
};

// El valor de una columna de la tabla de clase para un nivel (la posición 0
// es el nivel 1). Si la tabla es más corta, vale el último valor; vacía, 0.
const columnAt = (column: readonly number[], level: number): number =>
  column[Math.min(level, column.length) - 1] ?? 0;

// SRD 5.2.1, tabla "Rasgos de mago": columnas "Trucos", "Conjuros
// preparados" y "Espacios de conjuro por cada nivel de conjuro"; y mago,
// "Libro de conjuros": seis conjuros de nivel 1 y dos más por cada nivel de
// mago después del 1. null si la clase no lanza conjuros.
export function spellLimits(
  cls: ClassContent,
  level: number,
): SpellLimits | null {
  const spellcasting = cls.data.spellcasting;
  if (!spellcasting) return null;
  const slots = spellcasting.slotsByLevel[level - 1] ?? [];
  const maxSpellLevel = slots.reduce(
    (max, count, i) => (count > 0 ? i + 1 : max),
    0,
  );
  const { spellbook } = spellcasting;
  return {
    maxSpellLevel,
    cantrips: columnAt(spellcasting.cantripsByLevel, level),
    prepared: columnAt(spellcasting.preparedByLevel, level),
    spellbook: spellbook
      ? spellbook.initial + spellbook.perLevel * (level - 1)
      : null,
  };
}

// Orden de la hoja y de las listas para elegir: por nivel y después por nombre.
export const compareSpells = (a: SpellContent, b: SpellContent): number =>
  a.data.level - b.data.level || a.name.localeCompare(b.name, "es");

// SRD 5.2.1, "Listas de conjuros": los conjuros de la lista de la clase, de
// los paquetes activos, ordenados.
export function classSpellList(
  classId: string,
  contentIndex: ReadonlyMap<string, Content>,
  activePackageIds: readonly string[],
): SpellContent[] {
  return [...contentIndex.values()]
    .filter(
      (c): c is SpellContent =>
        c.type === "spell" &&
        c.data.classIds.includes(classId) &&
        activePackageIds.includes(c.packageId),
    )
    .sort(compareSpells);
}
