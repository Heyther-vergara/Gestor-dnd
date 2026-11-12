// Creador de personajes de nivel 1 (ADR 0015): del borrador que va llenando
// el formulario paso a paso a un `Character` válido.
//
// Es lógica pura (sin React): recibe el contenido y devuelve errores o el
// personaje. La pantalla solo muestra lo que dice este módulo, así las reglas
// de creación se testean sin navegador.
//
// Reglas: SRD 5.2.1, "Creación de personajes", pasos 1 a 3.

import type { ContentIndex } from "@/rules-engine/engine";
import {
  type Ability,
  type Character,
  type Choice,
  characterSchema,
  type Content,
  type Skill,
} from "@/rules-engine/schemas";

export const ABILITIES: readonly Ability[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

// SRD 5.2.1, "Paso 3: puntuaciones de característica", "Conjunto estándar":
// 15, 14, 13, 12, 10 y 8.
export const STANDARD_ARRAY: readonly number[] = [15, 14, 13, 12, 10, 8];

// SRD 5.2.1, tabla "Conjunto estándar por clase" (Fue, Des, Con, Int, Sab,
// Car). Solo las clases que tiene el paquete. Es una sugerencia: el jugador
// puede cambiarla.
const SUGGESTED_BY_CLASS: Record<string, Record<Ability, number>> = {
  fighter: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 },
  wizard: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
};

// El nombre puede ser largo, pero no un párrafo.
export const MAX_NAME_LENGTH = 60;

export type Size = "tiny" | "small" | "medium" | "large";

// SRD 5.2.1, "Ajusta las puntuaciones de característica": +2 a una y +1 a
// otra distinta, o +1 a las tres del trasfondo.
export type AbilityBonusPlan =
  | { mode: "two-one"; plusTwo: Ability | null; plusOne: Ability | null }
  | { mode: "one-one-one" };

// Lo que el jugador va eligiendo. Todo empieza vacío (null) y se valida al
// final: así el formulario puede guardar elecciones a medias.
export type CharacterDraft = {
  name: string;
  speciesId: string | null;
  size: Size | null;
  classId: string | null;
  classSkills: Skill[];
  backgroundId: string | null;
  abilityBonus: AbilityBonusPlan;
  baseAbilityScores: Record<Ability, number | null>;
};

export const emptyDraft = (): CharacterDraft => ({
  name: "",
  speciesId: null,
  size: null,
  classId: null,
  classSkills: [],
  backgroundId: null,
  abilityBonus: { mode: "two-one", plusTwo: null, plusOne: null },
  baseAbilityScores: {
    str: null,
    dex: null,
    con: null,
    int: null,
    wis: null,
    cha: null,
  },
});

// Los pasos del formulario, en orden. Cada error pertenece a un paso, así la
// pantalla sabe a dónde volver.
export const BUILDER_STEPS = [
  "name",
  "species",
  "class",
  "background",
  "abilities",
] as const;
export type BuilderStep = (typeof BUILDER_STEPS)[number];
export type DraftErrors = Partial<Record<BuilderStep, string>>;

type ContentOf<T extends Content["type"]> = Extract<Content, { type: T }>;

function contentOfType<T extends Content["type"]>(
  index: ContentIndex,
  id: string | null,
  type: T,
): ContentOf<T> | undefined {
  if (id === null) return undefined;
  const content = index.get(id);
  return content?.type === type ? (content as ContentOf<T>) : undefined;
}

// Las opciones de cada paso, en el orden del paquete.
export function builderOptions(index: ContentIndex) {
  const all = [...index.values()];
  const ofType = <T extends Content["type"]>(type: T) =>
    all.filter((c): c is ContentOf<T> => c.type === type);
  return {
    species: ofType("species"),
    classes: ofType("class"),
    backgrounds: ofType("background"),
  };
}

// La sugerencia de la tabla para la clase, o null si la clase no está en ella.
export function suggestedAbilityScores(
  classId: string | null,
): Record<Ability, number> | null {
  if (classId === null) return null;
  return SUGGESTED_BY_CLASS[classId] ?? null;
}

// ¿Usa cada número del conjunto estándar exactamente una vez?
export function isStandardArrayAssignment(
  scores: Record<Ability, number | null>,
): scores is Record<Ability, number> {
  const values = ABILITIES.map((a) => scores[a]);
  if (values.some((v) => v === null)) return false;
  const sorted = [...(values as number[])].sort((a, b) => b - a);
  return sorted.every((v, i) => v === STANDARD_ARRAY[i]);
}

// Los aumentos del trasfondo como los guarda el personaje ({ str: 2, con: 1 }).
// null si el plan está incompleto.
export function abilityBonuses(
  plan: AbilityBonusPlan,
  background: ContentOf<"background">,
): Partial<Record<Ability, number>> | null {
  if (plan.mode === "one-one-one") {
    return Object.fromEntries(
      background.data.abilityOptions.map((a) => [a, 1]),
    );
  }
  if (plan.plusTwo === null || plan.plusOne === null) return null;
  return { [plan.plusTwo]: 2, [plan.plusOne]: 1 };
}

// Un mensaje por paso con el primer problema que encuentra. Vacío = listo.
export function draftErrors(
  draft: CharacterDraft,
  index: ContentIndex,
): DraftErrors {
  const errors: DraftErrors = {};

  const name = draft.name.trim();
  if (name === "") errors.name = "Escribí un nombre.";
  else if (name.length > MAX_NAME_LENGTH)
    errors.name = `El nombre puede tener hasta ${MAX_NAME_LENGTH} caracteres.`;

  // SRD 5.2.1, "Elige una especie": la especie define el tamaño. Si ofrece
  // más de uno (el humano puede ser mediano o pequeño), se elige.
  const species = contentOfType(index, draft.speciesId, "species");
  if (!species) errors.species = "Elegí una especie.";
  else if (species.data.size.length > 1) {
    if (draft.size === null || !species.data.size.includes(draft.size))
      errors.species = "Elegí un tamaño.";
  }

  // SRD 5.2.1, cada clase: "Competencias con habilidades: elige N".
  const cls = contentOfType(index, draft.classId, "class");
  if (!cls) errors.class = "Elegí una clase.";
  else {
    const { count, options } = cls.data.skillChoices;
    const unique = new Set(draft.classSkills);
    if (
      unique.size !== draft.classSkills.length ||
      draft.classSkills.some((s) => !options.includes(s))
    )
      errors.class = "Hay habilidades que esta clase no ofrece.";
    else if (draft.classSkills.length !== count)
      errors.class = `Elegí ${count} habilidades.`;
  }

  // SRD 5.2.1, "Ajusta las puntuaciones de característica".
  const background = contentOfType(index, draft.backgroundId, "background");
  if (!background) errors.background = "Elegí un trasfondo.";
  else {
    const plan = draft.abilityBonus;
    const offered = background.data.abilityOptions;
    if (plan.mode === "two-one") {
      if (plan.plusTwo === null || plan.plusOne === null)
        errors.background = "Elegí qué característica sube 2 y cuál sube 1.";
      else if (plan.plusTwo === plan.plusOne)
        errors.background = "El +2 y el +1 van en características distintas.";
      else if (
        !offered.includes(plan.plusTwo) ||
        !offered.includes(plan.plusOne)
      )
        errors.background =
          "Este trasfondo no permite subir esa característica.";
    }
  }

  if (!isStandardArrayAssignment(draft.baseAbilityScores))
    errors.abilities = "Usá cada número del conjunto estándar una sola vez.";

  return errors;
}

// Habilidades de la clase que ya da el trasfondo: elegirlas no suma nada,
// porque la competencia no se acumula (SRD 5.2.1, "El bonificador no se
// acumula"). La pantalla las muestra como aviso.
export function overlappingSkills(
  draft: CharacterDraft,
  index: ContentIndex,
): Skill[] {
  const background = contentOfType(index, draft.backgroundId, "background");
  if (!background) return [];
  return draft.classSkills.filter((s) =>
    background.data.skillProficiencies.includes(s),
  );
}

export type BuildResult =
  { ok: true; character: Character } | { ok: false; errors: DraftErrors };

// Del borrador al personaje. Solo guarda elecciones: el motor calcula la hoja.
export function buildCharacter(
  draft: CharacterDraft,
  index: ContentIndex,
  id: string,
): BuildResult {
  const errors = draftErrors(draft, index);
  const species = contentOfType(index, draft.speciesId, "species");
  const cls = contentOfType(index, draft.classId, "class");
  const background = contentOfType(index, draft.backgroundId, "background");
  const bonuses = background
    ? abilityBonuses(draft.abilityBonus, background)
    : null;
  if (
    Object.keys(errors).length > 0 ||
    !species ||
    !cls ||
    !background ||
    !bonuses ||
    !isStandardArrayAssignment(draft.baseAbilityScores)
  ) {
    return { ok: false, errors };
  }

  const choices: Choice[] = [
    { kind: "ability-bonus", contentId: background.id, level: 1, bonuses },
    { kind: "skills", contentId: cls.id, level: 1, skills: draft.classSkills },
  ];
  if (species.data.size.length > 1 && draft.size !== null) {
    choices.push({
      kind: "size",
      contentId: species.id,
      level: 1,
      size: draft.size,
    });
  }

  // `parse` aplica los valores por defecto (estado de partida en cero) y
  // comprueba que el personaje cumple el esquema.
  const character = characterSchema.parse({
    id,
    name: draft.name.trim(),
    edition: "2024",
    activePackageIds: ["srd-2024"],
    classes: [{ classId: cls.id, level: 1 }],
    speciesId: species.id,
    backgroundId: background.id,
    baseAbilityScores: draft.baseAbilityScores,
    choices,
    inventory: [],
  });
  return { ok: true, character };
}
