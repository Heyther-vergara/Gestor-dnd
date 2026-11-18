// Objetos homebrew (ADR 0019): de lo que escribe el usuario en el formulario a
// contenido de verdad (`Content` de tipo "item"), y de ahí al personaje.
//
// El homebrew no es un caso especial: el objeto es contenido como el del SRD,
// vive en un paquete con `source: "homebrew"` y el motor aplica sus efectos
// igual que los de una cota de malla. Este archivo solo arma ese contenido y
// lo pone en el inventario; las reglas siguen estando en `calculateSheet`.

import { type ContentIndex, createContentIndex } from "@/rules-engine/engine";
import {
  type Ability,
  abilitySchema,
  type Character,
  type Content,
  contentSchema,
  type DamageType,
  type Effect,
  type NumericTarget,
  skillSchema,
} from "@/rules-engine/schemas";

import {
  abilityNames,
  damageTypeNames,
  formatModifier,
  skillNames,
} from "./format";

export type HomebrewItem = Extract<Content, { type: "item" }>;

// --- Qué puede mejorar un objeto homebrew ---
// Un subconjunto de los `target` del motor (ADR 0003) con nombre en español.
// "save.all" no existe en el motor: es un atajo del formulario que se
// convierte en seis efectos, uno por salvación (como una capa de protección).
// La velocidad queda afuera por ahora: se guarda en pies y la hoja la muestra
// en metros, y un campo en pies confundiría.
export type BonusTarget = NumericTarget | "save.all";

const ABILITIES = abilitySchema.options;
const SKILLS = skillSchema.options;

export const bonusTargetGroups: {
  label: string;
  options: { target: BonusTarget; label: string }[];
}[] = [
  {
    label: "Combate",
    options: [
      { target: "ac", label: "Clase de Armadura" },
      { target: "initiative", label: "Iniciativa" },
      { target: "hp.max", label: "Puntos de golpe máximos" },
    ],
  },
  {
    label: "Conjuros",
    options: [
      { target: "spell.attack", label: "Ataque de conjuros" },
      { target: "spell.dc", label: "CD de salvación de conjuros" },
    ],
  },
  {
    label: "Salvaciones",
    options: [
      { target: "save.all", label: "Todas las salvaciones" },
      ...ABILITIES.map((a) => ({
        target: `save.${a}` as const,
        label: `Salvación de ${abilityNames[a].name}`,
      })),
    ],
  },
  {
    label: "Características (puntuación)",
    options: ABILITIES.map((a) => ({
      target: `ability.${a}` as const,
      label: abilityNames[a].name,
    })),
  },
  {
    label: "Habilidades",
    options: SKILLS.map((s) => ({
      target: `skill.${s}` as const,
      label: skillNames[s],
    })),
  },
];

const bonusTargetLabels = new Map<string, string>(
  bonusTargetGroups.flatMap((group) =>
    group.options.map((o) => [o.target, o.label] as const),
  ),
);

export const isBonusTarget = (value: string): value is BonusTarget =>
  bonusTargetLabels.has(value);

// --- El borrador del formulario ---

export type HomebrewItemDraft = {
  name: string;
  description: string;
  requiresAttunement: boolean;
  bonuses: { target: BonusTarget; value: number }[];
  resistances: DamageType[];
};

export const emptyHomebrewItemDraft: HomebrewItemDraft = {
  name: "",
  description: "",
  requiresAttunement: false,
  bonuses: [],
  resistances: [],
};

export const MAX_ITEM_NAME_LENGTH = 60;
export const MAX_ITEM_DESCRIPTION_LENGTH = 1000;
// Un tope generoso: un +10 ya rompe cualquier mesa, pero es homebrew.
export const MAX_BONUS = 10;

// "save.all" → los seis "save.<atributo>"; lo demás queda igual.
const expandTarget = (target: BonusTarget): NumericTarget[] =>
  target === "save.all" ? ABILITIES.map((a) => `save.${a}` as const) : [target];

// Qué está mal en el borrador, en español, para mostrarlo en el formulario.
// Vacío = se puede guardar.
export function homebrewItemErrors(draft: HomebrewItemDraft): string[] {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (name === "") errors.push("Pon un nombre.");
  if (name.length > MAX_ITEM_NAME_LENGTH) {
    errors.push(`El nombre puede tener hasta ${MAX_ITEM_NAME_LENGTH} letras.`);
  }
  if (draft.description.length > MAX_ITEM_DESCRIPTION_LENGTH) {
    errors.push(
      `La descripción puede tener hasta ${MAX_ITEM_DESCRIPTION_LENGTH} letras.`,
    );
  }
  for (const { target, value } of draft.bonuses) {
    if (
      !Number.isInteger(value) ||
      value === 0 ||
      Math.abs(value) > MAX_BONUS
    ) {
      errors.push(
        `${bonusTargetLabels.get(target)}: el bonificador tiene que ser un número entero entre −${MAX_BONUS} y +${MAX_BONUS}, distinto de 0.`,
      );
    }
  }
  // Dos bonificadores a lo mismo (o "todas las salvaciones" + una salvación)
  // se sumarían sin que se note en el formulario: mejor pedir uno solo.
  const targets = draft.bonuses.flatMap((b) => expandTarget(b.target));
  if (new Set(targets).size !== targets.length) {
    errors.push("Hay dos bonificadores a la misma cosa: deja uno solo.");
  }
  if (new Set(draft.resistances).size !== draft.resistances.length) {
    errors.push("Hay una resistencia repetida.");
  }
  return errors;
}

// Los efectos del objeto, con el mismo vocabulario que el SRD (ADR 0003):
// un bonificador es { op: "add" } y una resistencia es { op: "grant" }.
export function homebrewItemEffects(draft: HomebrewItemDraft): Effect[] {
  return [
    ...draft.bonuses.flatMap(({ target, value }) =>
      expandTarget(target).map((t): Effect => ({
        target: t,
        op: "add",
        value,
      })),
    ),
    ...draft.resistances.map((type): Effect => ({
      target: `resistance.${type}`,
      op: "grant",
    })),
  ];
}

export type BuildItemResult =
  { ok: true; item: HomebrewItem } | { ok: false; errors: string[] };

// Arma el objeto y lo valida con el mismo esquema que el contenido del SRD.
// Si el esquema lo rechaza, es un error del programa y no del usuario.
export function buildHomebrewItem(
  draft: HomebrewItemDraft,
  packageId: string,
  id: string,
): BuildItemResult {
  const errors = homebrewItemErrors(draft);
  if (errors.length > 0) return { ok: false, errors };

  const parsed = contentSchema.safeParse({
    id,
    packageId,
    type: "item",
    name: draft.name.trim(),
    description: draft.description.trim(),
    effects: homebrewItemEffects(draft),
    data: {
      // "magic": no es armadura ni escudo, así que no cambia si "llevas
      // armadura" y sus efectos se suman siempre que esté equipado.
      category: "magic",
      requiresAttunement: draft.requiresAttunement,
    },
  });
  if (!parsed.success || parsed.data.type !== "item") {
    return { ok: false, errors: ["No se pudo armar el objeto."] };
  }
  return { ok: true, item: parsed.data };
}

// Id del objeto: el nombre en kebab-case más un sufijo al azar. El sufijo
// evita chocar con un objeto del SRD ("daga") o con otro homebrew del mismo
// nombre. `suffix` se pasa de afuera para que los tests sean deterministas.
export function homebrewItemId(name: string, suffix: string): string {
  const slug = name
    .normalize("NFD") // "Anillo de protección" → "o" + tilde suelta
    .replace(/[̀-ͯ]/g, "") // se va la tilde
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return `${slug || "objeto"}-${suffix}`;
}

// Sufijo corto al azar para ids ("a1b2c3"). Solo en el navegador.
export function randomSuffix(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 6);
}

// El borrador de un objeto ya creado, para editarlo. Si las seis salvaciones
// tienen el mismo bonificador se muestra como "Todas las salvaciones".
export function draftFromHomebrewItem(item: HomebrewItem): HomebrewItemDraft {
  const bonuses: HomebrewItemDraft["bonuses"] = [];
  const resistances: DamageType[] = [];
  const saves = new Map<Ability, number>();
  for (const effect of item.effects) {
    if (effect.op === "grant") {
      if (effect.target.startsWith("resistance.")) {
        resistances.push(
          effect.target.slice("resistance.".length) as DamageType,
        );
      }
      continue;
    }
    if (effect.op !== "add") continue;
    if (effect.target.startsWith("save.")) {
      saves.set(effect.target.slice("save.".length) as Ability, effect.value);
      continue;
    }
    if (isBonusTarget(effect.target)) {
      bonuses.push({ target: effect.target, value: effect.value });
    }
  }
  const saveValues = new Set(saves.values());
  if (saves.size === ABILITIES.length && saveValues.size === 1) {
    bonuses.push({ target: "save.all", value: [...saveValues][0] ?? 0 });
  } else {
    for (const [ability, value] of saves) {
      bonuses.push({ target: `save.${ability}`, value });
    }
  }
  return {
    name: item.name,
    description: item.description,
    requiresAttunement: item.data.requiresAttunement,
    bonuses,
    resistances,
  };
}

// "+1 Clase de Armadura · Resistencia al fuego": qué hace el objeto, en una
// línea, para las listas.
export function homebrewItemSummary(item: HomebrewItem): string {
  const { bonuses, resistances, requiresAttunement } =
    draftFromHomebrewItem(item);
  const parts = [
    ...bonuses.map(
      (b) => `${formatModifier(b.value)} ${bonusTargetLabels.get(b.target)}`,
    ),
    ...resistances.map((type) => `Resistencia al ${damageTypeNames[type]}`),
  ];
  if (requiresAttunement) parts.push("Requiere sintonización");
  return parts.length > 0 ? parts.join(" · ") : "Sin efectos en la hoja";
}

// --- El objeto y el personaje ---

// El contenido del SRD más el homebrew (objetos y clases, ADR 0020), en un
// solo índice para el motor. Si un id se repitiera, gana el del SRD: un
// homebrew no puede pisar contenido oficial.
export function withHomebrew(
  base: ContentIndex,
  homebrew: readonly Content[],
): ContentIndex {
  if (homebrew.length === 0) return base;
  return createContentIndex([
    ...base.values(),
    ...homebrew.filter((content) => !base.has(content.id)),
  ]);
}

// Le da el objeto al personaje: activa el paquete homebrew (si no, el motor
// lo ignora) y lo pone en el inventario equipado. Si requiere sintonización
// queda sintonizado, porque dárselo a un personaje es para que lo use.
// Si ya lo tenía, no cambia nada.
export function giveItem(character: Character, item: HomebrewItem): Character {
  if (character.inventory.some((entry) => entry.itemId === item.id)) {
    return character;
  }
  const activePackageIds = character.activePackageIds.includes(item.packageId)
    ? character.activePackageIds
    : [...character.activePackageIds, item.packageId];
  return {
    ...character,
    activePackageIds,
    inventory: [
      ...character.inventory,
      {
        itemId: item.id,
        quantity: 1,
        equipped: true,
        attuned: item.data.requiresAttunement,
      },
    ],
  };
}

// Le saca el objeto. El paquete queda activo: no molesta y otros objetos del
// mismo paquete pueden seguir en el inventario.
export function takeItem(character: Character, itemId: string): Character {
  if (!character.inventory.some((entry) => entry.itemId === itemId)) {
    return character;
  }
  return {
    ...character,
    inventory: character.inventory.filter((entry) => entry.itemId !== itemId),
  };
}
