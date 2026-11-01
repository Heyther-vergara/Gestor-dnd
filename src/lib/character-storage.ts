// Guardado del personaje en el navegador (localStorage, ADR 0011). Desde el
// ADR 0013 es la copia local: la copia en la nube la maneja `character-sync`. Guarda solo el personaje, que ya es "elecciones + estado":
// la hoja se recalcula con el motor al cargar.
//
// Recibe el almacenamiento como parámetro (en vez de usar `window.localStorage`
// directo) para poder testearlo en Node con un almacenamiento falso.

import { z } from "zod";

import { type Character, characterSchema } from "@/rules-engine/schemas";

// Lo mínimo que necesitamos de localStorage.
export type KeyValueStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

// Cada guardado lleva un número de versión. Si algún día cambia el formato,
// sabemos qué versión leímos y podemos migrarla en vez de perder la hoja.
const STORAGE_VERSION = 1;

// El mismo formato se usa en el navegador y en la base de datos (ADR 0013).
export const savedCharacterSchema = z.strictObject({
  version: z.literal(STORAGE_VERSION),
  savedAt: z.iso.datetime(),
  character: characterSchema,
});

export type SavedCharacter = z.infer<typeof savedCharacterSchema>;

export function characterStorageKey(characterId: string): string {
  return `gestor-dnd:character:${characterId}`;
}

export type LoadResult =
  | { status: "loaded"; saved: SavedCharacter }
  | { status: "empty" }
  // Hay algo guardado pero no se puede usar (JSON roto, otra versión o un
  // personaje que ya no valida). Se ignora y la hoja arranca de cero.
  | { status: "invalid" };

export function loadCharacter(
  storage: KeyValueStorage,
  characterId: string,
): LoadResult {
  const raw = storage.getItem(characterStorageKey(characterId));
  if (raw === null) return { status: "empty" };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }
  return parseSavedCharacter(json, characterId);
}

// Valida algo guardado que viene de afuera del programa (el navegador o la
// base de datos). El usuario puede editarlo a mano o puede venir de una
// versión vieja de la app: se valida con Zod igual que cualquier dato externo.
export function parseSavedCharacter(
  json: unknown,
  characterId: string,
): LoadResult {
  const parsed = savedCharacterSchema.safeParse(json);
  if (!parsed.success) return { status: "invalid" };
  // Un personaje guardado con otro id no es este personaje.
  if (parsed.data.character.id !== characterId) return { status: "invalid" };
  return { status: "loaded", saved: parsed.data };
}

// Arma el sobre con versión y fecha que se guarda.
export function toSavedCharacter(
  character: Character,
  now: Date = new Date(),
): SavedCharacter {
  return { version: STORAGE_VERSION, savedAt: now.toISOString(), character };
}

export function saveCharacter(
  storage: KeyValueStorage,
  character: Character,
  now: Date = new Date(),
): void {
  writeSavedCharacter(storage, toSavedCharacter(character, now));
}

// Guarda un sobre ya armado (por ejemplo, el que vino de la nube) tal cual,
// sin cambiarle la fecha.
export function writeSavedCharacter(
  storage: KeyValueStorage,
  saved: SavedCharacter,
): void {
  storage.setItem(
    characterStorageKey(saved.character.id),
    JSON.stringify(saved),
  );
}

export function clearCharacter(
  storage: KeyValueStorage,
  characterId: string,
): void {
  storage.removeItem(characterStorageKey(characterId));
}
