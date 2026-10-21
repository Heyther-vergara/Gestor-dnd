// calculateSheet(): de las elecciones del personaje + el contenido, a la hoja calculada.
// Función pura: mismo personaje y mismo contenido → misma hoja, sin efectos secundarios.

import {
  type Ability,
  abilitySchema,
  type ArmorTraining,
  armorTrainingSchema,
  type Character,
  type Condition,
  type Content,
  type Effect,
  type GrantTarget,
  type HitDie,
  type Skill,
  skillAbilities,
  skillSchema,
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
  proficiencyBonus: number;
  savingThrows: Record<Ability, { modifier: number; proficient: boolean }>;
  skills: Record<
    Skill,
    { ability: Ability; modifier: number; proficiency: SkillProficiency }
  >;
  passivePerception: number;
  initiative: number;
  hitPoints: { max: number; current: number; temp: number };
  // Dados de golpe por tipo ({ d10: { total: 2, remaining: 1 } }) y en suma.
  // `remaining` descuenta los gastados de ese tipo.
  hitDice: {
    byDie: Partial<Record<HitDie, HitDiceCount>>;
    total: number;
    remaining: number;
  };
  // En pies, como el contenido importado (30 pies = 9 m).
  speed: number;
  // Alcance de la visión en la oscuridad en pies; 0 si no tiene.
  darkvision: number;
  // Una entrada por clase con lanzamiento de conjuros, en el orden de `classes`.
  spellcasting: SpellcastingStats[];
  // Consecuencias de la armadura equipada que no son un número de la hoja.
  // La interfaz las muestra como avisos (ADR 0007).
  armorPenalties: ArmorPenalties;
  // Problemas con los datos (contenido que falta, elecciones inválidas).
  // No rompen la hoja: lo afectado se ignora y la interfaz puede avisar.
  issues: string[];
};

// SRD 5.2.1, tabla de modificadores de característica: (puntuación − 10) / 2,
// redondeado hacia abajo. Math.floor redondea −0,5 a −1, como pide la tabla.
export const abilityModifier = (score: number): number =>
  Math.floor((score - 10) / 2);

export type SkillProficiency = "none" | "proficient" | "expertise";

export type { HitDie } from "../schemas";

export type HitDiceCount = { total: number; remaining: number };

export type SpellcastingStats = {
  classId: string;
  ability: Ability;
  saveDc: number;
  attackBonus: number;
  // false si llevás una armadura sin entrenamiento.
  canCast: boolean;
};

export type ArmorPenalties = {
  // SRD 5.2.1, "Entrenamiento con armaduras": desventaja en las pruebas con
  // d20 de Fuerza o Destreza y no podés lanzar conjuros.
  untrainedArmor: boolean;
  // SRD 5.2.1, "Escudos": el escudo no suma a la CA.
  untrainedShield: boolean;
  // SRD 5.2.1, "Armaduras", "Fuerza": velocidad −3 m (10 pies).
  insufficientStrength: boolean;
};

// SRD 5.2.1, "Armaduras", "Fuerza": la armadura reduce 3 m la velocidad.
const HEAVY_ARMOR_SPEED_PENALTY = 10;

// SRD 5.2.1, tabla "Puntos de golpe establecidos por clase": d12 → 7,
// d10 → 6, d8 → 5, d6 → 4. Es la mitad del dado + 1.
export const fixedHitPointsPerLevel = (hitDie: number): number =>
  hitDie / 2 + 1;

// SRD 5.2.1, "Cómo jugar", tabla "Bonificador por competencia": +2 hasta el
// nivel 4 y +1 cada 4 niveles después (5–8 → +3 … 17–20 → +6).
export const proficiencyBonusForLevel = (level: number): number =>
  2 + Math.floor((level - 1) / 4);

const MAX_CHARACTER_LEVEL = 20;

// SRD 5.2.1, "Crear un personaje": el aumento del trasfondo no puede subir
// una puntuación por encima de 20.
const BACKGROUND_BONUS_CAP = 20;

const ABILITIES = abilitySchema.options;
const SKILLS = skillSchema.options;

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
  const wornArmor = equippedItems.filter(
    ({ item }) => item.data.category === "armor",
  );
  const heldShields = equippedItems.filter(
    ({ item }) => item.data.category === "shield",
  );
  const wearingArmor = wornArmor.length > 0;
  const holdingShield = heldShields.length > 0;

  // SRD 5.2.1, "Solo un tipo": una sola armadura y un solo escudo a la vez.
  // Con dos armaduras se sigue usando la mejor base (ADR 0003); de los
  // escudos se cuenta solo el primero.
  if (wornArmor.length > 1) {
    issues.push(
      `Hay ${wornArmor.length} armaduras equipadas; solo se puede llevar una`,
    );
  }
  if (heldShields.length > 1) {
    issues.push(
      `Hay ${heldShields.length} escudos equipados; solo se puede embrazar uno`,
    );
  }
  const ignoredShields = new Set(heldShields.slice(1));
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

  // Las clases encontradas, con su nivel. `starting` marca la clase inicial,
  // que es la primera de `classes` (salvaciones y PG de nivel 1).
  const ownedClasses: {
    cls: Extract<Content, { type: "class" }>;
    level: number;
    starting: boolean;
  }[] = [];
  for (const [position, { classId, level }] of character.classes.entries()) {
    const cls = find(classId, "class");
    if (!cls) continue;
    ownedClasses.push({ cls, level, starting: position === 0 });
    collected.push(...cls.effects);
    // Solo los rasgos que ya se alcanzaron con el nivel de esa clase.
    for (const feature of cls.data.features) {
      if (feature.level <= level) collected.push(...feature.effects);
    }
  }

  // Los efectos del escudo dependen del entrenamiento, que a su vez sale de
  // los demás efectos. Por eso se juntan aparte y se agregan después.
  const shieldEffects: Effect[] = [];
  for (const entry of equippedItems) {
    const { item, attuned } = entry;
    // Un objeto que requiere sintonización no hace nada hasta sintonizarlo.
    if (item.data.requiresAttunement && !attuned) continue;
    if (item.data.category === "shield") {
      if (!ignoredShields.has(entry)) shieldEffects.push(...item.effects);
      continue;
    }
    collected.push(...item.effects);
  }

  const applies = (e: Effect) =>
    e.condition === undefined || conditionHolds[e.condition];
  const grantsOf = (list: readonly Effect[]) =>
    list.flatMap((e) => (applies(e) && e.op === "grant" ? [e.target] : []));
  const granted = new Set<GrantTarget>(grantsOf(collected));

  // --- Entrenamiento con armaduras ---
  // SRD 5.2.1, "Entrenamiento con armaduras": lo dan la clase y otros rasgos.
  // La clase inicial da todo su entrenamiento; las demás, solo el de
  // "Como personaje multiclase".
  const armorTraining = new Set<ArmorTraining>();
  for (const { cls, starting } of ownedClasses) {
    const list = starting
      ? cls.data.armorProficiencies
      : cls.data.multiclassArmorProficiencies;
    for (const training of list) armorTraining.add(training);
  }
  for (const training of armorTrainingSchema.options) {
    if (granted.has(`proficiency.armor.${training}`)) {
      armorTraining.add(training);
    }
  }

  const untrainedArmor = wornArmor.some(
    ({ item }) =>
      item.data.armor !== undefined &&
      !armorTraining.has(item.data.armor.armorCategory),
  );
  // SRD 5.2.1, "Escudos": solo obtenés el bonificador a la CA si tenés
  // entrenamiento con escudos. Sin él se ignoran los efectos del escudo.
  const untrainedShield = holdingShield && !armorTraining.has("shield");
  if (!untrainedShield) {
    collected.push(...shieldEffects);
    for (const target of grantsOf(shieldEffects)) granted.add(target);
  }

  const applicable = collected.filter(applies);
  const effects: NumericEffect[] = applicable.filter(isNumericEffect);

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

  // --- Bonificador por competencia ---
  // SRD 5.2.1, "Multiclase": se basa en el nivel total del personaje.
  const totalLevel = character.classes.reduce((sum, c) => sum + c.level, 0);
  if (totalLevel > MAX_CHARACTER_LEVEL) {
    issues.push(
      `El nivel total es ${totalLevel}; el máximo es ${MAX_CHARACTER_LEVEL}`,
    );
  }
  const proficiencyBonus = proficiencyBonusForLevel(
    Math.min(totalLevel, MAX_CHARACTER_LEVEL),
  );

  // --- Tiradas de salvación ---
  // SRD 5.2.1, "Convertirse en <clase>", "Como personaje multiclase": las
  // salvaciones solo las da la clase inicial, que es la primera de `classes`.
  const startingClass = ownedClasses.find((c) => c.starting)?.cls;
  const savingThrows = Object.fromEntries(
    ABILITIES.map((ability) => {
      const proficient =
        (startingClass?.data.savingThrows.includes(ability) ?? false) ||
        granted.has(`proficiency.save.${ability}`);
      const modifier = applyNumericEffects(
        modifiers[ability] + (proficient ? proficiencyBonus : 0),
        effectsFor(effects, `save.${ability}`),
        modifiers,
      );
      return [ability, { modifier, proficient }];
    }),
  ) as ComputedSheet["savingThrows"];

  // --- Habilidades ---
  const proficientSkills = new Set<Skill>(
    SKILLS.filter((skill) => granted.has(`proficiency.skill.${skill}`)),
  );
  // SRD 5.2.1, "Creación de personajes": el trasfondo da dos habilidades.
  for (const skill of background?.data.skillProficiencies ?? []) {
    proficientSkills.add(skill);
  }

  const ownedContentIds = new Set<string>([
    character.speciesId,
    character.backgroundId,
    ...(background ? [background.data.featId] : []),
    ...character.classes.map((c) => c.classId),
  ]);

  for (const choice of character.choices) {
    if (choice.kind !== "skills") continue;
    if (!ownedContentIds.has(choice.contentId)) {
      issues.push(
        `Habilidades elegidas de "${choice.contentId}", que tu personaje no tiene`,
      );
      continue;
    }
    // Si las ofrece una clase, se comprueban sus opciones y cuántas permite.
    // La especie y las dotes todavía no declaran sus opciones en el contenido.
    const cls = contentIndex.get(choice.contentId);
    if (cls?.type === "class") {
      const { count, options } = cls.data.skillChoices;
      if (choice.skills.some((skill) => !options.includes(skill))) {
        issues.push(
          `La clase "${cls.id}" solo permite elegir ${options.join(", ")}`,
        );
        continue;
      }
      if (choice.skills.length > count) {
        issues.push(`La clase "${cls.id}" permite elegir ${count} habilidades`);
        continue;
      }
    }
    for (const skill of choice.skills) proficientSkills.add(skill);
  }

  // SRD 5.2.1, glosario, "Pericia": solo en habilidades en las que ya sos
  // competente, y no se acumula.
  const expertSkills = new Set<Skill>();
  for (const choice of character.choices) {
    if (choice.kind !== "expertise") continue;
    if (!ownedContentIds.has(choice.contentId)) {
      issues.push(
        `Pericia elegida de "${choice.contentId}", que tu personaje no tiene`,
      );
      continue;
    }
    for (const skill of choice.skills) {
      if (proficientSkills.has(skill)) expertSkills.add(skill);
      else issues.push(`Pericia en "${skill}" sin ser competente`);
    }
  }

  // SRD 5.2.1, "El bonificador no se acumula": aunque la competencia venga de
  // varios lados, el bonificador se suma una vez (o dos con pericia).
  const skills = Object.fromEntries(
    SKILLS.map((skill) => {
      const ability = skillAbilities[skill];
      const proficiency: SkillProficiency = expertSkills.has(skill)
        ? "expertise"
        : proficientSkills.has(skill)
          ? "proficient"
          : "none";
      const multiplier = { none: 0, proficient: 1, expertise: 2 }[proficiency];
      const modifier = applyNumericEffects(
        modifiers[ability] + proficiencyBonus * multiplier,
        effectsFor(effects, `skill.${skill}`),
        modifiers,
      );
      return [skill, { ability, modifier, proficiency }];
    }),
  ) as ComputedSheet["skills"];

  // SRD 5.2.1, "Rellena los números": Percepción pasiva = 10 + modificador
  // para pruebas de Sabiduría (Percepción).
  const passivePerception = 10 + skills.perception.modifier;

  // --- Iniciativa ---
  // SRD 5.2.1, "Rellena los números": la iniciativa es el modificador por
  // Destreza. Dote "Alerta": suma el bonificador por competencia.
  const initiative = applyNumericEffects(
    modifiers.dex +
      (granted.has("proficiency.initiative") ? proficiencyBonus : 0),
    effectsFor(effects, "initiative"),
    modifiers,
  );

  // --- Puntos de golpe y dados de golpe ---
  const cappedLevel = Math.min(totalLevel, MAX_CHARACTER_LEVEL);
  let classHitPoints = 0;
  const diceByType: Partial<Record<HitDie, number>> = {};
  for (const { cls, level, starting } of ownedClasses) {
    const { hitDie } = cls.data;
    const die: HitDie = `d${hitDie}`;
    diceByType[die] = (diceByType[die] ?? 0) + level;

    // SRD 5.2.1, "Multiclase": solo la clase inicial (la primera) da los PG
    // del nivel 1: el dado entero + Con ("Puntos de golpe en el nivel 1 por clase").
    let levelsAfterFirst = level;
    if (starting) {
      classHitPoints += hitDie + modifiers.con;
      levelsAfterFirst = level - 1;
    }
    // SRD 5.2.1, "Subir de nivel", paso 2: valor establecido + Con, mínimo 1.
    // Se usa siempre el valor fijo; tirar el dado sería otra elección a guardar.
    classHitPoints +=
      levelsAfterFirst *
      Math.max(1, fixedHitPointsPerLevel(hitDie) + modifiers.con);
  }

  // "hp.max-per-level" (p. ej. "Aguante enano") se multiplica por el nivel total.
  const hitPointsPerLevel = applyNumericEffects(
    0,
    effectsFor(effects, "hp.max-per-level"),
    modifiers,
  );
  const maxHitPoints = applyNumericEffects(
    classHitPoints + hitPointsPerLevel * cappedLevel,
    effectsFor(effects, "hp.max"),
    modifiers,
  );
  const { damageTaken, tempHp, hitDiceSpent } = character.playState;
  const hitPoints = {
    max: maxHitPoints,
    // SRD 5.2.1, "Puntos de golpe": no bajan de 0.
    current: Math.max(0, maxHitPoints - damageTaken),
    temp: tempHp,
  };
  const byDie: Partial<Record<HitDie, HitDiceCount>> = {};
  let totalHitDice = 0;
  let remainingHitDice = 0;
  for (const [die, total] of Object.entries(diceByType) as [HitDie, number][]) {
    const remaining = Math.max(0, total - (hitDiceSpent[die] ?? 0));
    byDie[die] = { total, remaining };
    totalHitDice += total;
    remainingHitDice += remaining;
  }
  const hitDice = {
    byDie,
    total: totalHitDice,
    remaining: remainingHitDice,
  };

  // --- Velocidad ---
  // SRD 5.2.1, "Armaduras", "Fuerza": si la armadura pide una Fuerza mayor que
  // la tuya (la final, con aumentos), tu velocidad baja 3 m (10 pies).
  const insufficientStrength = wornArmor.some(
    ({ item }) => (item.data.armor?.strengthRequirement ?? 0) > scores.str,
  );
  const speed = applyNumericEffects(
    Math.max(
      0,
      (species?.data.speed ?? 0) -
        (insufficientStrength ? HEAVY_ARMOR_SPEED_PENALTY : 0),
    ),
    effectsFor(effects, "speed"),
    modifiers,
  );

  // --- Visión en la oscuridad ---
  // Sin rasgos es 0. La especie la da como "base" (enano: 120 pies) y otros
  // efectos pueden sumarle alcance (ADR 0006).
  const darkvision = applyNumericEffects(
    0,
    effectsFor(effects, "senses.darkvision"),
    modifiers,
  );

  // --- Lanzamiento de conjuros ---
  // SRD 5.2.1, "Rellena los números": CD = 8 + aptitud mágica + competencia;
  // ataque = aptitud mágica + competencia. "Multiclase": cada conjuro usa la
  // aptitud de su clase, así que va una entrada por clase.
  const spellcasting: SpellcastingStats[] = ownedClasses.flatMap(({ cls }) => {
    if (!cls.data.spellcasting) return [];
    const { ability } = cls.data.spellcasting;
    const base = modifiers[ability] + proficiencyBonus;
    return [
      {
        classId: cls.id,
        ability,
        saveDc: applyNumericEffects(
          8 + base,
          effectsFor(effects, "spell.dc"),
          modifiers,
        ),
        attackBonus: applyNumericEffects(
          base,
          effectsFor(effects, "spell.attack"),
          modifiers,
        ),
        // SRD 5.2.1, "Entrenamiento con armaduras": sin entrenamiento con la
        // armadura que llevás, no podés lanzar conjuros.
        canCast: !untrainedArmor,
      },
    ];
  });

  return {
    abilities,
    ac,
    proficiencyBonus,
    savingThrows,
    skills,
    passivePerception,
    initiative,
    hitPoints,
    hitDice,
    speed,
    darkvision,
    spellcasting,
    armorPenalties: { untrainedArmor, untrainedShield, insufficientStrength },
    issues,
  };
}

function modifiersOf(scores: Record<Ability, number>): Modifiers {
  return Object.fromEntries(
    ABILITIES.map((a) => [a, abilityModifier(scores[a])]),
  ) as Modifiers;
}
