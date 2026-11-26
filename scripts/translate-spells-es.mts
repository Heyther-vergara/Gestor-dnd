// Pasa los conjuros de src/content/srd-2024/spells.json al texto oficial del
// SRD 5.2.1 en español (ADR 0031). No traduce nada: copia nombre, tiempo de
// lanzamiento, alcance, material, duración y descripción del documento de
// Wizards, que también tiene licencia CC-BY-4.0.
//
// Uso: pnpm content:spells-es [ruta al .txt]
// Por defecto lee docs/reference/srd-5.2.1-es.txt (fuera de git, ver el
// README de esa carpeta). Hay que correrlo después de `pnpm content:import`,
// que vuelve a escribir los conjuros en inglés.

import { readFile, writeFile } from "node:fs/promises";

import type { Content } from "@/rules-engine/schemas";

type Spell = Extract<Content, { type: "spell" }>;
type School = Spell["data"]["school"];

const SPELLS_FILE = new URL(
  "../src/content/srd-2024/spells.json",
  import.meta.url,
);
const DEFAULT_SOURCE = new URL(
  "../docs/reference/srd-5.2.1-es.txt",
  import.meta.url,
);

// Nombre en español de cada conjuro, tal como lo titula el capítulo
// "Descripciones de conjuros". El id (de 5e-bits) sigue en inglés porque los
// personajes guardados lo usan: cambiarlo rompería los que ya existen.
const SPANISH_NAMES: Record<string, string> = {
  // Trucos
  "acid-splash": "Salpicadura ácida",
  "chill-touch": "Toque helado",
  "dancing-lights": "Luces danzantes",
  elementalism: "Elementalismo",
  "fire-bolt": "Descarga de fuego",
  light: "Luz",
  "mage-hand": "Mano de mago",
  mending: "Reparar",
  message: "Mensaje",
  "minor-illusion": "Ilusión menor",
  "poison-spray": "Rociada venenosa",
  prestidigitation: "Prestidigitación",
  "ray-of-frost": "Rayo de escarcha",
  "shocking-grasp": "Agarre electrizante",
  "true-strike": "Impacto certero",
  // Nivel 1
  alarm: "Alarma",
  "burning-hands": "Manos ardientes",
  "charm-person": "Hechizar persona",
  "chromatic-orb": "Orbe cromático",
  "color-spray": "Rociada de color",
  "comprehend-languages": "Entender idiomas",
  "detect-magic": "Detectar magia",
  "disguise-self": "Disfrazarse",
  "expeditious-retreat": "Retirada expeditiva",
  "false-life": "Falsa vida",
  "feather-fall": "Caída de pluma",
  "find-familiar": "Encontrar familiar",
  "floating-disk": "Disco flotante",
  "fog-cloud": "Nube de oscurecimiento",
  grease: "Grasa",
  "hideous-laughter": "Risa horrible",
  "ice-knife": "Cuchillo de hielo",
  identify: "Identificar",
  "illusory-script": "Texto ilusorio",
  jump: "Salto",
  longstrider: "Zancada prodigiosa",
  "mage-armor": "Armadura de mago",
  "magic-missile": "Proyectil mágico",
  "protection-from-evil-and-good": "Protección contra el bien y el mal",
  "ray-of-sickness": "Rayo nauseabundo",
  shield: "Escudo",
  "silent-image": "Imagen silenciosa",
  sleep: "Dormir",
  thunderwave: "Ola atronadora",
  "unseen-servant": "Sirviente invisible",
  // Nivel 2
  "acid-arrow": "Flecha ácida",
  "alter-self": "Alterar el propio aspecto",
  "arcane-lock": "Cerradura arcana",
  "arcanists-magic-aura": "Aura mágica de arcanista",
  augury: "Augurio",
  "blindness-deafness": "Sordera/ceguera",
  blur: "Contorno borroso",
  "continual-flame": "Llama permanente",
  darkness: "Oscuridad",
  darkvision: "Visión en la oscuridad",
  "detect-thoughts": "Detectar pensamientos",
  "dragons-breath": "Aliento de dragón",
  "enhance-ability": "Potenciar característica",
  "enlarge-reduce": "Agrandar/reducir",
  "flaming-sphere": "Esfera de llamas",
  "gentle-repose": "Dulce descanso",
  "gust-of-wind": "Ráfaga de viento",
  "hold-person": "Inmovilizar persona",
  invisibility: "Invisibilidad",
  knock: "Abrir",
  levitate: "Levitar",
  "locate-object": "Localizar objeto",
  "magic-mouth": "Boca mágica",
  "magic-weapon": "Arma mágica",
  "mind-spike": "Clavo mental",
  "mirror-image": "Imagen múltiple",
  "misty-step": "Paso brumoso",
  "phantasmal-force": "Fuerza fantasmal",
  "ray-of-enfeeblement": "Rayo debilitador",
  "rope-trick": "Truco de la cuerda",
  "scorching-ray": "Rayo abrasador",
  "see-invisibility": "Ver invisibilidad",
  shatter: "Hacer añicos",
  "spider-climb": "Trepar cual arácnido",
  suggestion: "Sugestión",
  web: "Telaraña",
  // Nivel 3
  "animate-dead": "Animar a los muertos",
  "bestow-curse": "Imponer maldición",
  blink: "Desplazamiento",
  clairvoyance: "Clarividencia",
  counterspell: "Contrahechizo",
  "dispel-magic": "Disipar magia",
  fear: "Terror",
  fireball: "Bola de fuego",
  fly: "Volar",
  "gaseous-form": "Forma gaseosa",
  "glyph-of-warding": "Glifo custodio",
  haste: "Acelerar",
  "hypnotic-pattern": "Patrón hipnótico",
  "lightning-bolt": "Relámpago",
  "magic-circle": "Círculo mágico",
  "major-image": "Imagen mayor",
  nondetection: "Indetectable",
  "phantom-steed": "Corcel fantasma",
  "protection-from-energy": "Protección contra energía",
  "remove-curse": "Levantar maldición",
  sending: "Recado",
  "sleet-storm": "Tormenta de aguanieve",
  slow: "Ralentizar",
  "speak-with-dead": "Hablar con los muertos",
  "stinking-cloud": "Nube apestosa",
  "tiny-hut": "Pequeña choza",
  tongues: "Don de lenguas",
  "vampiric-touch": "Toque vampírico",
  "water-breathing": "Respirar bajo el agua",
};

// Escuelas como las escribe la línea bajo el nombre ("Evocación de nivel 3",
// "Truco de ilusionismo").
const SCHOOLS: Record<string, School> = {
  abjuración: "abjuration",
  adivinación: "divination",
  conjuración: "conjuration",
  encantamiento: "enchantment",
  evocación: "evocation",
  ilusionismo: "illusion",
  nigromancia: "necromancy",
  transmutación: "transmutation",
};
const SCHOOL = Object.keys(SCHOOLS).join("|");
const LEVEL_LINE = new RegExp(
  `^(?:Truco de (${SCHOOL})|(${SCHOOL}) de nivel (\\d))\\b`,
  "i",
);
// El pie de cada página del PDF ("119 Documento de referencia...") y el
// título del capítulo que repite arriba.
const PAGE_FOOTER = /^\d+ Documento de referencia del sistema 5\.2\.1$/;
const CHAPTER_TITLE = "Descripciones de conjuros";
// Conjuros cuyo texto el PDF guarda lejos de su título, por cómo están las
// columnas en la página: el texto empieza en la línea indicada y llega hasta
// el próximo conjuro. En "Detectar pensamientos" quedó dentro de "Destierro".
const MISPLACED_BODIES: Record<string, string> = {
  "Detectar pensamientos": "Activas uno de los siguientes efectos.",
};
// Subtítulos que en el PDF van en su propia línea pero siguen en la de abajo.
const RUN_IN_HEADINGS = ["Con un espacio de conjuro de nivel superior."];

type Parsed = {
  name: string;
  level: number;
  school: School;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
};

// pdftotext deja un espacio al final de las líneas que siguen en la de abajo
// (el renglón se cortó por el ancho de la columna) y ninguno al final de un
// párrafo. Una palabra partida termina en guion ("mien‑" + "tras").
function joinLines(lines: readonly string[]): string {
  const paragraphs: string[] = [];
  let current = "";
  for (const raw of lines) {
    const continues = raw.endsWith(" ");
    const line = raw.trim();
    if (line === "") continue;
    if (/[‑-]$/.test(line) && !continues) {
      current += line.slice(0, -1);
      continue;
    }
    current += line;
    if (continues) {
      current += " ";
    } else {
      paragraphs.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) paragraphs.push(current.trim());
  // "Con un espacio de conjuro de nivel superior." va pegado a su texto.
  const merged: string[] = [];
  for (const p of paragraphs) {
    const previous = merged.at(-1);
    if (previous !== undefined && RUN_IN_HEADINGS.includes(previous)) {
      merged[merged.length - 1] = `${previous} ${p}`;
    } else {
      merged.push(p);
    }
  }
  return merged.join("\n");
}

// Recorre el capítulo y separa cada conjuro: el nombre es la línea de arriba
// de "Evocación de nivel 3 (...)" y el texto llega hasta el próximo nombre.
function parseSpells(text: string): Map<string, Parsed> {
  // \u0002 es un guion de corte que el PDF deja dentro de algunas palabras
  // ("murcié\u0002lago"): no se ve, así que se quita.
  const lines = text
    .replaceAll("\r", "")
    .replaceAll("\u0002", "")
    .split("\n")
    .filter((l) => !PAGE_FOOTER.test(l.trim()) && l.trim() !== CHAPTER_TITLE);

  // Índices de las líneas con el nombre de un conjuro.
  const starts: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!LEVEL_LINE.test(lines[i] ?? "")) continue;
    // La lista de clases puede ocupar dos líneas.
    const next = lines[i + 1] ?? "";
    const after = lines[i + 2] ?? "";
    if (
      next.startsWith("Tiempo de lanzamiento:") ||
      after.startsWith("Tiempo de lanzamiento:")
    )
      starts.push(i - 1);
  }

  const spells = new Map<string, Parsed>();
  starts.forEach((start, n) => {
    const end = starts[n + 1] ?? lines.length;
    const block = lines.slice(start, end);
    const name = (block[0] ?? "").trim();
    const match = LEVEL_LINE.exec(block[1] ?? "");
    if (!match) return;
    // Un dato puede seguir en la línea de abajo ("M (una gota de sangre, un
    // pedazo" + "de carne...)"): igual que en el texto, la línea que termina
    // en espacio continúa. Devuelve el valor y su última línea.
    const field = (label: string): [string, number] => {
      let i = block.findIndex((l) => l.startsWith(`${label}:`));
      if (i < 0) throw new Error(`"${name}": falta "${label}"`);
      let value = (block[i] ?? "").slice(label.length + 1);
      while (value.endsWith(" ") && i + 1 < block.length) {
        i++;
        value += block[i] ?? "";
      }
      return [value.trim(), i];
    };
    const [castingTime] = field("Tiempo de lanzamiento");
    const [range] = field("Alcance");
    const [components] = field("Componentes");
    const [duration, durationLine] = field("Duración");
    const schoolName = (match[1] ?? match[2] ?? "").toLowerCase();
    spells.set(name, {
      name,
      level: match[3] ? Number(match[3]) : 0,
      school: SCHOOLS[schoolName] as School,
      castingTime,
      range,
      components,
      duration,
      description: joinLines(block.slice(durationLine + 1)),
    });
  });

  for (const [name, firstLine] of Object.entries(MISPLACED_BODIES)) {
    const spell = spells.get(name);
    const from = lines.findIndex((l) => l.startsWith(firstLine));
    if (!spell || from < 0) continue;
    const to = starts.find((s) => s > from) ?? lines.length;
    spell.description = joinLines(lines.slice(from, to));
  }
  return spells;
}

// "V, S, M (una pizca de fósforo)" → qué letras tiene y el material.
function componentsOf(text: string): Spell["data"]["components"] {
  const letters = text
    .replace(/\(.*\)/, "")
    .split(",")
    .map((l) => l.trim());
  return {
    verbal: letters.includes("V"),
    somatic: letters.includes("S"),
    material: /\bM \((.+)\)$/.exec(text)?.[1],
  };
}

async function main(): Promise<void> {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  const text = await readFile(source, "utf8");
  const parsed = parseSpells(text);
  const spells = JSON.parse(await readFile(SPELLS_FILE, "utf8")) as Spell[];

  const problems: string[] = [];
  const translated = spells.map((spell): Spell => {
    const name = SPANISH_NAMES[spell.id];
    const es = name ? parsed.get(name) : undefined;
    if (!name || !es || es.description === "") {
      problems.push(`${spell.id}: no está en el SRD en español ("${name}")`);
      return spell;
    }
    // Que el nombre elegido sea el mismo conjuro: mismo nivel y escuela.
    if (es.level !== spell.data.level || es.school !== spell.data.school)
      problems.push(`${spell.id}: "${name}" es de otro nivel o escuela`);
    // Componentes, concentración y ritual también salen del texto oficial.
    // Si 5e-bits decía otra cosa, se avisa para revisarlo a mano.
    const components = componentsOf(es.components);
    const concentration = es.duration.startsWith("Concentración");
    const ritual = /\britual\b/.test(es.castingTime);
    const before = spell.data;
    if (
      before.concentration !== concentration ||
      before.ritual !== ritual ||
      before.components.verbal !== components.verbal ||
      before.components.somatic !== components.somatic ||
      Boolean(before.components.material) !== Boolean(components.material)
    )
      console.log(`  ! ${spell.id}: 5e-bits no coincide con el SRD en español`);
    return {
      ...spell,
      name: es.name,
      description: es.description,
      data: {
        ...spell.data,
        castingTime: es.castingTime,
        range: es.range,
        components,
        duration: es.duration,
        concentration,
        ritual,
      },
    };
  });

  if (problems.length > 0) {
    throw new Error(`No se pudo pasar al español:\n${problems.join("\n")}`);
  }
  await writeFile(SPELLS_FILE, `${JSON.stringify(translated, null, 2)}\n`);
  console.log(
    `Listo: ${translated.length} conjuros en español. Valida con: pnpm test`,
  );
}

await main();
