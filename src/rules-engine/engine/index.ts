// calculateSheet(): de las elecciones del personaje + el contenido, a la hoja calculada.
// Función pura: mismo personaje y mismo contenido → misma hoja, sin efectos secundarios.

import {
  type Ability,
  abilitySchema,
  type Character,
  type Condition,
  type Content,
  type Effect,
} from "../schemas";
import {
  applyNumericEffects,
  effectsFor,
  isNumericEffect,
  type Modifiers,
  type NumericEffect,
} from "./effects";

export {
  applyNumericEffects,
  isNumericEffect,
  type NumericEffect,
  resolveEffectValue,
} from "./effects";

// Todo el contenido disponible, buscable por id.
export type ContentIndex = ReadonlyMap<string, Content>;

export const createContentIndex = (
  contents: readonly Content[],
): ContentIndex => new Map(contents.map((c) => [c.id, c]));

export type ComputedSheet = {
  abilities: Record<Ability, { score: number; modifier: number }>;
  ac: number;
  // Problemas con los datos (contenido que falta, elecciones inválidas).
  // No rompen la hoja: lo afectado se ignora y la interfaz puede avisar.
  issues: string[];
};

// SRD 5.2.1, tabla de modificadores de característica: (puntuación − 10) / 2,
// redondeado hacia abajo. Math.floor redondea −0,5 a −1, como pide la tabla.
export const abilityModifier = (score: number): number =>
  Math.floor((score - 10) / 2);

// SRD 5.2.1, "Crear un personaje": el aumento del trasfondo no puede subir
// una puntuación por encima de 20.
const BACKGROUND_BONUS_CAP = 20;

const ABILITIES = abilitySchema.options;

export function calculateSheet(
  character: Character,
  contentIndex: ContentIndex,
): ComputedSheet {
  const issues: string[] = [];

  // Busca contenido de los paquetes activos y del tipo esperado.
  const find = <T extends Content["type"]>(
    id: string,
    type: T,
  ): Extract<Content, { type: T }> | undefined => {
    const found = contentIndex.get(id);
    if (!found || found.type !== type) {
      issues.push(`No se encontró ${type} "${id}"`);
      return undefined;
    }
    if (!character.activePackageIds.includes(found.packageId)) {
      issues.push(
        `"${id}" es del paquete "${found.packageId}", que no está activo`,
      );
      return undefined;
    }
    return found as Extract<Content, { type: T }>;
  };

  // --- Objetos equipados: aportan efectos y deciden si "llevás armadura" ---
  const equippedItems = character.inventory.flatMap((entry) => {
    if (!entry.equipped) return [];
    const item = find(entry.itemId, "item");
    return item ? [{ item, attuned: entry.attuned }] : [];
  });

  // ADR 0003: "llevar armadura" y "portar escudo" salen de los objetos equipados.
  const wearingArmor = equippedItems.some(
    ({ item }) => item.data.category === "armor",
  );
  const holdingShield = equippedItems.some(
    ({ item }) => item.data.category === "shield",
  );
  const conditionHolds: Record<Condition, boolean> = {
    unarmored: !wearingArmor,
    "unarmored-no-shield": !wearingArmor && !holdingShield,
  };

  // --- Juntar los efectos de todo el contenido elegido ---
  const collected: Effect[] = [];

  const species = find(character.speciesId, "species");
  if (species) {
    collected.push(...species.effects);
    for (const trait of species.data.traits) collected.push(...trait.effects);
  }

  const background = find(character.backgroundId, "background");
  if (background) {
    collected.push(...background.effects);
    const feat = find(background.data.featId, "feat");
    if (feat) collected.push(...feat.effects);
  }

  for (const { classId, level } of character.classes) {
    const cls = find(classId, "class");
    if (!cls) continue;
    collected.push(...cls.effects);
    // Solo los rasgos que ya se alcanzaron con el nivel de esa clase.
    for (const feature of cls.data.features) {
      if (feature.level <= level) collected.push(...feature.effects);
    }
  }

  for (const { item, attuned } of equippedItems) {
    // Un objeto que requiere sintonización no hace nada hasta sintonizarlo.
    if (item.data.requiresAttunement && !attuned) continue;
    collected.push(...item.effects);
  }

  const effects: NumericEffect[] = collected
    .filter(isNumericEffect)
    .filter((e) => e.condition === undefined || conditionHolds[e.condition]);

  // --- Puntuaciones de característica ---
  const scores = { ...character.baseAbilityScores };

  for (const choice of character.choices) {
    if (choice.kind !== "ability-bonus") continue;
    if (!background || choice.contentId !== background.id) {
      issues.push(
        `Aumento de características de "${choice.contentId}", que no es tu trasfondo`,
      );
      continue;
    }
    const offered = background.data.abilityOptions;
    const entries = Object.entries(choice.bonuses) as [Ability, number][];
    if (entries.some(([ability]) => !offered.includes(ability))) {
      issues.push(
        `El trasfondo "${background.id}" solo permite aumentar ${offered.join(", ")}`,
      );
      continue;
    }
    for (const [ability, bonus] of entries) {
      scores[ability] = Math.min(scores[ability] + bonus, BACKGROUND_BONUS_CAP);
    }
  }

  // Los efectos sobre características que usan `abilities` toman los
  // modificadores de antes de aplicar efectos, para no depender de sí mismos.
  const baseModifiers = modifiersOf(scores);
  for (const ability of ABILITIES) {
    scores[ability] = applyNumericEffects(
      scores[ability],
      effectsFor(effects, `ability.${ability}`),
      baseModifiers,
    );
  }

  const modifiers = modifiersOf(scores);
  const abilities = Object.fromEntries(
    ABILITIES.map((a) => [a, { score: scores[a], modifier: modifiers[a] }]),
  ) as ComputedSheet["abilities"];

  // --- Clase de armadura ---
  // SRD 5.2.1, glosario, "Clase de armadura": la base es 10 + Des; armaduras y
  // rasgos proponen otras bases y se usa una sola (la mayor, ADR 0003).
  const ac = applyNumericEffects(
    10 + modifiers.dex,
    effectsFor(effects, "ac"),
    modifiers,
  );

  return { abilities, ac, issues };
}

function modifiersOf(scores: Record<Ability, number>): Modifiers {
  return Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(scores[a])]),
  ) as Modifiers;
}
