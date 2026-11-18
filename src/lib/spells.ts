// Elegir conjuros (ADR 0021): qué conjuros se pueden elegir en cada lista
// de una clase y cómo cambia el personaje al marcar o desmarcar uno.
//
// Es lógica pura, como el creador y subir de nivel: la hoja, el creador y la
// pantalla de nivel solo muestran lo que dice este módulo.
//
// Reglas: SRD 5.2.1, mago, "Lanzamiento de conjuros": Trucos, Libro de
// conjuros, Conjuros preparados de nivel 1+ y "Cambiar tus conjuros
// preparados".

import {
  classSpellList,
  type ContentIndex,
  type SpellContent,
  type SpellLimits,
  spellLimits,
} from "@/rules-engine/engine";
import { type Character, characterSchema } from "@/rules-engine/schemas";

export type SpellListKind = "cantripIds" | "spellbookIds" | "preparedSpellIds";

export type ClassSpellOptions = {
  classId: string;
  limits: SpellLimits;
  // Los trucos de la lista de la clase.
  cantrips: SpellContent[];
  // Los conjuros de nivel 1+ que puede tener el libro (de niveles con
  // espacios). null = la clase no usa libro.
  spellbook: SpellContent[] | null;
  // Lo que se puede preparar: lo del libro o, sin libro, la lista entera,
  // siempre de niveles con espacios.
  prepared: SpellContent[];
};

type ClassEntry = Character["classes"][number];

// Las opciones de cada lista para una clase del personaje, con su nivel
// actual. null si la clase no está, no lanza conjuros o no es del índice.
export function classSpellOptions(
  character: Pick<Character, "classes" | "activePackageIds">,
  classId: string,
  index: ContentIndex,
): ClassSpellOptions | null {
  const entry = character.classes.find((c) => c.classId === classId);
  const cls = index.get(classId);
  if (!entry || cls?.type !== "class") return null;
  const limits = spellLimits(cls, entry.level);
  if (!limits) return null;

  const list = classSpellList(classId, index, character.activePackageIds);
  const castable = list.filter(
    (s) => s.data.level >= 1 && s.data.level <= limits.maxSpellLevel,
  );
  const spellbook = limits.spellbook === null ? null : castable;
  const inBook = new Set(entry.spellbookIds ?? []);
  return {
    classId,
    limits,
    cantrips: list.filter((s) => s.data.level === 0),
    spellbook,
    prepared: spellbook ? castable.filter((s) => inBook.has(s.id)) : castable,
  };
}

const maxFor = (kind: SpellListKind, limits: SpellLimits): number =>
  kind === "cantripIds"
    ? limits.cantrips
    : kind === "spellbookIds"
      ? (limits.spellbook ?? 0)
      : limits.prepared;

const optionsFor = (kind: SpellListKind, options: ClassSpellOptions) =>
  kind === "cantripIds"
    ? options.cantrips
    : kind === "spellbookIds"
      ? (options.spellbook ?? [])
      : options.prepared;

// ¿Se puede marcar este conjuro en esta lista? (Desmarcar siempre se puede.)
export function canAddSpell(
  character: Character,
  classId: string,
  kind: SpellListKind,
  spellId: string,
  index: ContentIndex,
): boolean {
  const options = classSpellOptions(character, classId, index);
  const entry = character.classes.find((c) => c.classId === classId);
  if (!options || !entry) return false;
  const current = entry[kind] ?? [];
  return (
    !current.includes(spellId) &&
    current.length < maxFor(kind, options.limits) &&
    optionsFor(kind, options).some((s) => s.id === spellId)
  );
}

// Marca o desmarca un conjuro en una lista de la clase. Devuelve el mismo
// personaje si no se puede (lista llena, conjuro que no se ofrece), así la
// hoja no guarda nada. Sacar un conjuro del libro también lo saca de los
// preparados.
export function toggleSpell(
  character: Character,
  classId: string,
  kind: SpellListKind,
  spellId: string,
  index: ContentIndex,
): Character {
  const entry = character.classes.find((c) => c.classId === classId);
  if (!entry) return character;
  const current = entry[kind] ?? [];

  let next: ClassEntry;
  if (current.includes(spellId)) {
    next = { ...entry, [kind]: current.filter((id) => id !== spellId) };
    if (kind === "spellbookIds") {
      next.preparedSpellIds = (entry.preparedSpellIds ?? []).filter(
        (id) => id !== spellId,
      );
    }
  } else {
    if (!canAddSpell(character, classId, kind, spellId, index))
      return character;
    next = { ...entry, [kind]: [...current, spellId] };
  }
  return characterSchema.parse({
    ...character,
    classes: character.classes.map((c) => (c.classId === classId ? next : c)),
  });
}

// Error de una elección de "elige N conjuros" del creador o de subir de
// nivel: los ids tienen que estar entre las opciones, sin repetir, y ser
// exactamente `count`. undefined = está bien.
export function spellPickError(
  ids: readonly string[],
  options: readonly SpellContent[],
  count: number,
  noun: string,
): string | undefined {
  const offered = new Set(options.map((s) => s.id));
  if (new Set(ids).size !== ids.length || ids.some((id) => !offered.has(id)))
    return `Hay ${noun} que no se pueden elegir.`;
  if (ids.length !== count)
    return `Elige ${count} ${noun} (llevas ${ids.length}).`;
  return undefined;
}
