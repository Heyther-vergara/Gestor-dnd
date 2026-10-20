// Importa un subconjunto del SRD 5.2.1 desde 5e-bits/5e-database y lo convierte a nuestro formato.
// Uso: pnpm content:import  → reescribe src/content/srd-2024/*.json
// La validación con Zod la hace el test src/content/__tests__/srd-2024.test.ts.
//
// Licencias: el texto del SRD 5.2.1 es de Wizards of the Coast (CC-BY-4.0);
// la estructuración en JSON es de 5e-bits (MIT). Ver docs/decisions/0002-srd-2024-source.md.

import { mkdir, writeFile } from "node:fs/promises";

import type {
  Ability,
  Content,
  Effect,
  Package,
  Skill,
} from "@/rules-engine/schemas";

// Versión fija de 5e-bits para que el resultado sea reproducible.
const SOURCE_COMMIT = "bce51b3958573819e3b842fbc0cd9524fe4bc2e1";
const SOURCE_BASE = `https://raw.githubusercontent.com/5e-bits/5e-database/${SOURCE_COMMIT}/src/2024/en`;
const OUTPUT_DIR = new URL("../src/content/srd-2024/", import.meta.url);
const PACKAGE_ID = "srd-2024";
const MAX_LEVEL = 5; // MVP: niveles 1–5

// --- Qué importamos ---

const CLASS_IDS = ["fighter", "wizard"];
const SPECIES_IDS = ["dwarf", "human", "halfling"];
const BACKGROUND_IDS = ["acolyte", "sage", "soldier"];
const SPELL_IDS = [
  // Trucos
  "fire-bolt",
  "light",
  "mage-hand",
  "minor-illusion",
  "prestidigitation",
  "ray-of-frost",
  "shocking-grasp",
  // Nivel 1
  "burning-hands",
  "charm-person",
  "chromatic-orb",
  "comprehend-languages",
  "detect-magic",
  "feather-fall",
  "find-familiar",
  "identify",
  "mage-armor",
  "magic-missile",
  "shield",
  "sleep",
  "thunderwave",
];

// --- Correcciones y efectos escritos a mano (5e-bits no modela efectos) ---

// 5e-bits marca al humano solo como Medium; en el SRD 5.2.1 puede ser Medium o Small.
const SIZE_OVERRIDES: Record<string, SpeciesSize[]> = {
  human: ["medium", "small"],
};

// Efectos por índice de rasgo de especie.
// La visión en la oscuridad es una "base": "max" es un techo en el motor y daría 0 (ADR 0006).
const TRAIT_EFFECTS: Record<string, Effect[]> = {
  "darkvision-120": [{ target: "senses.darkvision", op: "base", value: 120 }],
  "dwarven-toughness": [{ target: "hp.max-per-level", op: "add", value: 1 }],
};

// Errores de 5e-bits en la tabla "Armas" del SRD 5.2.1 (verificados contra el PDF en español).
const WEAPON_OVERRIDES: Record<string, Partial<WeaponData>> = {
  // Honda: 1d4 contundente (5e-bits dice perforante).
  sling: { damage: { dice: "1d4", type: "bludgeoning" } },
  // Tridente: 1d8 perforante, versátil (1d10) (5e-bits dice 1d6 / 1d8).
  trident: { damage: { dice: "1d8", type: "piercing" }, versatileDice: "1d10" },
};

// Ids que chocan con otro contenido del paquete: el escudo y el conjuro Escudo
// se llaman "shield" en 5e-bits, y el índice de contenido necesita ids únicos.
const ITEM_ID_OVERRIDES: Record<string, string> = {
  shield: "shield-item",
};

// --- Tipos mínimos del JSON de 5e-bits (solo los campos que usamos) ---

type Ref = { index: string; name: string };
type Option = { item?: Ref };
type Choice = { choose: number; from: { options: Option[] } };

type SourceClass = {
  index: string;
  name: string;
  hit_die: number;
  primary_ability: {
    ability_scores?: Ref[];
    ability_score_options?: { from: { options: Option[] } };
  };
  proficiency_choices: Choice[];
  proficiencies: Ref[];
  saving_throws: Ref[];
  spellcasting?: { spellcasting_ability: Ref };
};
type SourceFeature = {
  index: string;
  name: string;
  description: string;
  level: Ref;
  class: Ref;
  subclass?: Ref;
};
type SourceSpecies = {
  index: string;
  name: string;
  size?: string;
  size_options?: { from: { options: { size: string }[] } };
  speed: number;
  traits: Ref[];
};
type SourceTrait = { index: string; name: string; description: string };
type SourceBackground = {
  index: string;
  name: string;
  ability_scores: Ref[];
  feat: Ref;
  proficiencies: Ref[];
  proficiency_choices?: { desc: string }[];
  equipment_options: { desc: string }[];
};
type SourceFeat = {
  index: string;
  name: string;
  description: string;
  type: string;
  repeatable?: string;
  prerequisite?: string;
};
type SourceDamage = { damage_dice: string; damage_type: Ref };
type SourceRange = { normal: number; long?: number };
type SourceEquipment = {
  index: string;
  name: string;
  equipment_categories: Ref[];
  cost: { quantity: number; unit: string };
  weight?: number;
  description?: string;
  notes?: string[];
  // Armaduras y escudo
  armor_class?: { base: number; dex_bonus: boolean; max_bonus?: number };
  str_minimum?: number;
  stealth_disadvantage?: boolean;
  // Armas
  damage?: SourceDamage;
  two_handed_damage?: SourceDamage;
  range?: SourceRange;
  throw_range?: SourceRange;
  properties?: Ref[];
  mastery?: Ref;
};
type SourceSpell = {
  index: string;
  name: string;
  level: number;
  school: Ref;
  classes: Ref[];
  casting_time: string;
  ritual: boolean;
  range: string;
  components: string[];
  material?: string;
  duration: string;
  concentration: boolean;
  description: string;
  higher_level?: string;
};

// Tipos de nuestro esquema, derivados de Content para no duplicarlos.
type DataOf<T extends Content["type"]> = Extract<Content, { type: T }>["data"];
type SpeciesSize = DataOf<"species">["size"][number];
type FeatCategory = DataOf<"feat">["category"];
type SpellSchool = DataOf<"spell">["school"];
type HitDie = DataOf<"class">["hitDie"];
type ItemData = DataOf<"item">;
type WeaponData = NonNullable<ItemData["weapon"]>;
type ArmorCategory = NonNullable<ItemData["armor"]>["armorCategory"];

// --- Utilidades ---

async function load<T>(file: string): Promise<T[]> {
  const response = await fetch(`${SOURCE_BASE}/5e-SRD-${file}.json`);
  if (!response.ok) {
    throw new Error(`No se pudo descargar ${file}: HTTP ${response.status}`);
  }
  return (await response.json()) as T[];
}

function pick<T extends { index: string }>(items: T[], ids: string[]): T[] {
  return ids.map((id) => {
    const found = items.find((item) => item.index === id);
    if (!found) throw new Error(`No existe "${id}" en 5e-bits`);
    return found;
  });
}

const toAbility = (ref: Ref) => ref.index as Ability;
// "skill-animal-handling" → "animal-handling"
const toSkill = (ref: Ref) => ref.index.replace(/^skill-/, "") as Skill;
const toSize = (size: string) => size.toLowerCase() as SpeciesSize;
// "fighter-3" → 3
const levelOf = (ref: Ref) => Number(ref.index.split("-").pop());

// Competencias de armas y armaduras de 5e-bits → vocabulario propio.
const ARMOR_PROFICIENCIES: Record<string, string[]> = {
  "all-armor": ["light", "medium", "heavy"],
  "light-armor": ["light"],
  "medium-armor": ["medium"],
  "heavy-armor": ["heavy"],
  shields: ["shield"],
};
const WEAPON_PROFICIENCIES: Record<string, string> = {
  "simple-weapons": "simple",
  "martial-weapons": "martial",
};

// --- Conversores ---

function convertClass(source: SourceClass, features: SourceFeature[]): Content {
  const primary = source.primary_ability.ability_scores ?? [];
  const primaryOptions =
    source.primary_ability.ability_score_options?.from.options.flatMap((o) =>
      o.item ? [o.item] : [],
    ) ?? [];
  const skillChoice = source.proficiency_choices[0];
  if (!skillChoice)
    throw new Error(`${source.index}: sin elección de habilidades`);

  return {
    id: source.index,
    packageId: PACKAGE_ID,
    type: "class",
    name: source.name,
    description: "",
    effects: [],
    data: {
      hitDie: source.hit_die as HitDie,
      primaryAbilities: [...primary, ...primaryOptions].map(toAbility),
      savingThrows: source.saving_throws.map(toAbility),
      skillChoices: {
        count: skillChoice.choose,
        options: skillChoice.from.options.flatMap((o) =>
          o.item ? [toSkill(o.item)] : [],
        ),
      },
      armorProficiencies: source.proficiencies.flatMap(
        (p) => ARMOR_PROFICIENCIES[p.index] ?? [],
      ),
      weaponProficiencies: source.proficiencies.flatMap((p) => {
        const weapon = WEAPON_PROFICIENCIES[p.index];
        return weapon ? [weapon] : [];
      }),
      spellcasting: source.spellcasting
        ? {
            ability: toAbility(source.spellcasting.spellcasting_ability),
            preparation: "prepared", // en 2024 todas las clases preparan conjuros
          }
        : undefined,
      features: features
        .filter(
          (f) =>
            f.class.index === source.index &&
            !f.subclass &&
            levelOf(f.level) <= MAX_LEVEL,
        )
        .map((f) => ({
          level: levelOf(f.level),
          name: f.name,
          description: f.description,
          effects: [],
        })),
    },
  };
}

function convertSpecies(source: SourceSpecies, traits: SourceTrait[]): Content {
  const sizes =
    SIZE_OVERRIDES[source.index] ??
    (source.size
      ? [toSize(source.size)]
      : (source.size_options?.from.options.map((o) => toSize(o.size)) ?? []));

  return {
    id: source.index,
    packageId: PACKAGE_ID,
    type: "species",
    name: source.name,
    description: "",
    effects: [],
    data: {
      size: sizes,
      speed: source.speed,
      traits: pick(
        traits,
        source.traits.map((t) => t.index),
      ).map((t) => ({
        name: t.name,
        description: t.description,
        effects: TRAIT_EFFECTS[t.index] ?? [],
      })),
    },
  };
}

function convertBackground(source: SourceBackground): Content {
  return {
    id: source.index,
    packageId: PACKAGE_ID,
    type: "background",
    name: source.name,
    description: "",
    effects: [],
    data: {
      abilityOptions: source.ability_scores.map(toAbility),
      featId: source.feat.index,
      skillProficiencies: source.proficiencies
        .filter((p) => p.index.startsWith("skill-"))
        .map(toSkill),
      toolProficiency:
        source.proficiency_choices?.[0]?.desc ??
        source.proficiencies
          .filter((p) => p.index.startsWith("tool-"))
          .map((p) => p.name.replace(/^Tool: /, ""))
          .join(", "),
      equipment: source.equipment_options[0]?.desc ?? "",
    },
  };
}

function convertFeat(source: SourceFeat): Content {
  return {
    id: source.index,
    packageId: PACKAGE_ID,
    type: "feat",
    name: source.name,
    description: source.description,
    effects: [],
    data: {
      category: source.type as FeatCategory,
      prerequisite: source.prerequisite,
      repeatable: Boolean(source.repeatable),
    },
  };
}

function convertSpell(source: SourceSpell): Content {
  const description = source.higher_level
    ? `${source.description}\n\n**Using a Higher-Level Spell Slot.** ${source.higher_level}`
    : source.description;

  return {
    id: source.index,
    packageId: PACKAGE_ID,
    type: "spell",
    name: source.name,
    description,
    effects: [],
    data: {
      level: source.level,
      school: source.school.index as SpellSchool,
      castingTime: source.casting_time,
      range: source.range,
      components: {
        verbal: source.components.includes("V"),
        somatic: source.components.includes("S"),
        material: source.components.includes("M") ? source.material : undefined,
      },
      duration: source.duration,
      concentration: source.concentration,
      ritual: source.ritual,
      classIds: source.classes.map((c) => c.index),
    },
  };
}

// Solo armaduras, escudo y armas por ahora: es lo que usa el motor.
// El equipo de aventurero, herramientas, munición y objetos mágicos quedan para más adelante.
function convertEquipment(source: SourceEquipment): Content | undefined {
  const categories = source.equipment_categories.map((c) => c.index);
  const common = {
    id: ITEM_ID_OVERRIDES[source.index] ?? source.index,
    packageId: PACKAGE_ID,
    type: "item" as const,
    name: source.name,
    description: [source.description, ...(source.notes ?? [])]
      .filter(Boolean)
      .join("\n"),
  };
  const base = {
    weight: source.weight,
    cost: {
      amount: source.cost.quantity,
      unit: source.cost.unit as NonNullable<ItemData["cost"]>["unit"],
    },
    requiresAttunement: false,
  };

  // SRD 5.2.1, "Armaduras": escudo +2 a la CA.
  if (categories.includes("shields")) {
    return {
      ...common,
      effects: [
        { target: "ac", op: "add", value: source.armor_class?.base ?? 2 },
      ],
      data: { ...base, category: "shield" },
    };
  }

  // ADR 0003: la CA de la armadura va como un único efecto "base".
  if (categories.includes("armor")) {
    const ac = source.armor_class;
    if (!ac) throw new Error(`${source.index}: armadura sin armor_class`);
    const armorCategory = categories
      .find((c) => c.endsWith("-armor"))
      ?.replace(/-armor$/, "") as ArmorCategory | undefined;
    if (!armorCategory) throw new Error(`${source.index}: sin categoría`);
    // 5e-bits pone max_bonus: 0 en las pesadas, que no suman Des: ahí no va `abilities`.
    const acEffect: Effect = ac.dex_bonus
      ? {
          target: "ac",
          op: "base",
          value: ac.base,
          abilities: ["dex"],
          ...(ac.max_bonus === undefined
            ? {}
            : { maxAbilityBonus: ac.max_bonus }),
        }
      : { target: "ac", op: "base", value: ac.base };
    return {
      ...common,
      effects: [acEffect],
      data: {
        ...base,
        category: "armor",
        armor: {
          armorCategory,
          strengthRequirement: source.str_minimum || undefined,
          stealthDisadvantage: Boolean(source.stealth_disadvantage),
        },
      },
    };
  }

  if (categories.includes("weapons")) {
    if (!source.damage || !source.mastery) {
      throw new Error(`${source.index}: arma sin daño o maestría`);
    }
    const properties = (source.properties ?? []).map(
      (p) => p.index as WeaponData["properties"][number],
    );
    const attackType = categories.includes("ranged-weapons")
      ? "ranged"
      : "melee";
    // Alcance: el de disparo para las armas a distancia, el de lanzamiento para las arrojadizas.
    const range = attackType === "ranged" ? source.range : source.throw_range;
    const weapon: WeaponData = {
      weaponCategory: categories.includes("martial-weapons")
        ? "martial"
        : "simple",
      attackType,
      damage: {
        dice: source.damage.damage_dice,
        type: source.damage.damage_type.index as WeaponData["damage"]["type"],
      },
      versatileDice: source.two_handed_damage?.damage_dice,
      properties,
      mastery: source.mastery.index as WeaponData["mastery"],
      range: range?.long
        ? { normal: range.normal, long: range.long }
        : undefined,
      ...WEAPON_OVERRIDES[source.index],
    };
    return {
      ...common,
      effects: [],
      data: { ...base, category: "weapon", weapon },
    };
  }

  return undefined;
}

// --- Principal ---

const manifest: Package = {
  id: PACKAGE_ID,
  name: "SRD 5.2.1",
  edition: "2024",
  author: "Wizards of the Coast",
  version: "5.2.1",
  visibility: "public",
  source: "srd",
};

async function writeJson(file: string, data: unknown) {
  await writeFile(
    new URL(file, OUTPUT_DIR),
    `${JSON.stringify(data, null, 2)}\n`,
  );
  console.log(`  ✓ ${file}`);
}

async function main() {
  console.log(`Descargando 5e-bits @ ${SOURCE_COMMIT.slice(0, 7)}…`);
  const [
    classes,
    features,
    species,
    traits,
    backgrounds,
    feats,
    spells,
    equipment,
  ] = await Promise.all([
    load<SourceClass>("Classes"),
    load<SourceFeature>("Features"),
    load<SourceSpecies>("Species"),
    load<SourceTrait>("Traits"),
    load<SourceBackground>("Backgrounds"),
    load<SourceFeat>("Feats"),
    load<SourceSpell>("Spells"),
    load<SourceEquipment>("Equipment"),
  ]);

  const pickedBackgrounds = pick(backgrounds, BACKGROUND_IDS);
  // Solo las dotes que otorgan los trasfondos elegidos, sin repetir.
  const featIds = [...new Set(pickedBackgrounds.map((b) => b.feat.index))];

  await mkdir(OUTPUT_DIR, { recursive: true });
  console.log("Escribiendo src/content/srd-2024/:");
  await writeJson("manifest.json", manifest);
  await writeJson(
    "classes.json",
    pick(classes, CLASS_IDS).map((c) => convertClass(c, features)),
  );
  await writeJson(
    "species.json",
    pick(species, SPECIES_IDS).map((s) => convertSpecies(s, traits)),
  );
  await writeJson("backgrounds.json", pickedBackgrounds.map(convertBackground));
  await writeJson("feats.json", pick(feats, featIds).map(convertFeat));
  await writeJson("spells.json", pick(spells, SPELL_IDS).map(convertSpell));
  await writeJson(
    "items.json",
    equipment.flatMap((e) => convertEquipment(e) ?? []),
  );
  console.log("Listo. Valida con: pnpm test");
}

await main();
