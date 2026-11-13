// Subir de nivel del 2 al 5 (ADR 0016): qué trae el próximo nivel, qué hay que
// elegir y cómo queda el personaje después.
//
// Como el creador (ADR 0015), es lógica pura: la pantalla solo muestra lo que
// dice este módulo, y las reglas se testean sin navegador.
//
// Reglas: SRD 5.2.1, "Subir de nivel": se elige la clase, se suma un dado de
// golpe y los PG (valor fijo de la tabla "Puntos de golpe establecidos por
// clase") y se anotan los rasgos nuevos.

import { calculateSheet, type ContentIndex } from "@/rules-engine/engine";
import {
  type Ability,
  type Character,
  characterSchema,
  type Choice,
  type Content,
} from "@/rules-engine/schemas";

// El MVP llega hasta el nivel 5: el contenido importado no tiene rasgos más
// allá (MAX_LEVEL en scripts/import-srd-2024.mts).
export const MAX_LEVEL_SUPPORTED = 5;

// SRD 5.2.1, dote "Mejora de característica": "no puede aumentar una
// puntuación de característica por encima de 20".
const ABILITY_SCORE_CAP = 20;

type ClassContent = Extract<Content, { type: "class" }>;
type SubclassContent = Extract<Content, { type: "subclass" }>;
type LevelFeature = ClassContent["data"]["features"][number];

// "+2 a una" o "+1 a dos". null = todavía sin elegir.
export type ImprovementPlan =
  | { mode: "plus-two"; ability: Ability | null }
  | { mode: "one-one"; first: Ability | null; second: Ability | null };

export type LevelUpDraft = {
  subclassId: string | null;
  improvement: ImprovementPlan;
};

export const emptyLevelUpDraft = (): LevelUpDraft => ({
  subclassId: null,
  improvement: { mode: "plus-two", ability: null },
});

export type LevelUpPlan = {
  classId: string;
  // El nivel que se alcanza.
  level: number;
  // Rasgos de clase que se ganan en ese nivel.
  features: LevelFeature[];
  // Subclases para elegir si el nivel da subclase; vacío si no.
  subclassOptions: SubclassContent[];
  needsImprovement: boolean;
};

export type LevelUpCheck =
  { ok: true; plan: LevelUpPlan } | { ok: false; reason: string };

// ¿Puede subir de nivel? Y si puede, qué trae el nivel siguiente.
// Solo personajes de una clase: la multiclase queda para la versión 1.
export function planLevelUp(
  character: Character,
  index: ContentIndex,
): LevelUpCheck {
  if (character.classes.length !== 1) {
    return {
      ok: false,
      reason: "Por ahora solo se puede subir de nivel con una sola clase.",
    };
  }
  const [entry] = character.classes as [Character["classes"][number]];
  const cls = index.get(entry.classId);
  if (cls?.type !== "class") {
    return { ok: false, reason: "No se encontró la clase del personaje." };
  }
  if (entry.level >= MAX_LEVEL_SUPPORTED) {
    return {
      ok: false,
      reason: `Por ahora el nivel máximo es ${MAX_LEVEL_SUPPORTED}.`,
    };
  }

  const level = entry.level + 1;
  const features = cls.data.features.filter((f) => f.level === level);
  const grantsSubclass = features.some((f) => f.grants === "subclass");
  const subclassOptions = grantsSubclass
    ? [...index.values()].filter(
        (c): c is SubclassContent =>
          c.type === "subclass" &&
          c.data.classId === cls.id &&
          character.activePackageIds.includes(c.packageId),
      )
    : [];
  return {
    ok: true,
    plan: {
      classId: cls.id,
      level,
      features,
      subclassOptions,
      needsImprovement: features.some(
        (f) => f.grants === "ability-score-improvement",
      ),
    },
  };
}

// Los aumentos como los guarda el personaje ({ int: 2 } o { str: 1, con: 1 }).
// null si el plan está incompleto o repite la característica.
export function improvementBonuses(
  plan: ImprovementPlan,
): Partial<Record<Ability, number>> | null {
  if (plan.mode === "plus-two") {
    return plan.ability === null ? null : { [plan.ability]: 2 };
  }
  if (plan.first === null || plan.second === null) return null;
  if (plan.first === plan.second) return null;
  return { [plan.first]: 1, [plan.second]: 1 };
}

export type LevelUpErrors = { subclass?: string; improvement?: string };

// Un mensaje por elección con el primer problema. Vacío = listo.
export function levelUpErrors(
  character: Character,
  plan: LevelUpPlan,
  draft: LevelUpDraft,
  index: ContentIndex,
): LevelUpErrors {
  const errors: LevelUpErrors = {};

  if (plan.subclassOptions.length > 0) {
    const ids = plan.subclassOptions.map((s) => s.id);
    if (draft.subclassId === null || !ids.includes(draft.subclassId))
      errors.subclass = "Elegí una subclase.";
  }

  if (plan.needsImprovement) {
    const bonuses = improvementBonuses(draft.improvement);
    if (bonuses === null) {
      errors.improvement =
        draft.improvement.mode === "one-one"
          ? "Elegí dos características distintas."
          : "Elegí qué característica sube.";
    } else {
      // SRD 5.2.1: no se puede pasar de 20. Una característica que ya está
      // en 20 no puede subir, y +2 sobre 19 desperdiciaría un punto.
      const { abilities } = calculateSheet(character, index);
      const over = (Object.entries(bonuses) as [Ability, number][]).some(
        ([ability, bonus]) =>
          abilities[ability].score + bonus > ABILITY_SCORE_CAP,
      );
      if (over)
        errors.improvement = `Ninguna característica puede pasar de ${ABILITY_SCORE_CAP}.`;
    }
  }

  return errors;
}

export type LevelUpResult =
  { ok: true; character: Character } | { ok: false; errors: LevelUpErrors };

// El personaje con un nivel más. Solo cambia elecciones (nivel, subclase,
// mejora): los PG, la competencia y los espacios los recalcula el motor.
export function applyLevelUp(
  character: Character,
  plan: LevelUpPlan,
  draft: LevelUpDraft,
  index: ContentIndex,
): LevelUpResult {
  const errors = levelUpErrors(character, plan, draft, index);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, character: leveled(character, plan, draft) };
}

// PG máximos que suma el nivel con lo elegido hasta ahora: la diferencia
// entre la hoja de antes y la de después. Así incluye todo (Con, "Aguante
// enano", una mejora de Constitución).
export function hitPointGain(
  character: Character,
  plan: LevelUpPlan,
  draft: LevelUpDraft,
  index: ContentIndex,
): number {
  return (
    calculateSheet(leveled(character, plan, draft), index).hitPoints.max -
    calculateSheet(character, index).hitPoints.max
  );
}

// Arma el personaje subido de nivel sin validar. Lo incompleto se omite.
function leveled(
  character: Character,
  plan: LevelUpPlan,
  draft: LevelUpDraft,
): Character {
  const choices: Choice[] = [...character.choices];
  const bonuses = improvementBonuses(draft.improvement);
  if (plan.needsImprovement && bonuses) {
    choices.push({
      kind: "ability-score-improvement",
      contentId: plan.classId,
      level: plan.level,
      bonuses,
    });
  }

  const offersSubclass = plan.subclassOptions.length > 0;
  const classes = character.classes.map((entry) =>
    entry.classId === plan.classId
      ? {
          ...entry,
          level: plan.level,
          ...(offersSubclass &&
            draft.subclassId !== null && { subclassId: draft.subclassId }),
        }
      : entry,
  );

  // `parse` comprueba que el resultado sigue cumpliendo el esquema. El
  // estado de partida (daño, dados gastados) se conserva.
  return characterSchema.parse({ ...character, classes, choices });
}
