// Guardado del personaje en dos lugares (ADR 0013):
// - la nube (Supabase), que es la copia principal;
// - el navegador (localStorage), que queda como copia local por si no hay
//   conexión o la nube no está configurada.
//
// Este archivo no importa Supabase: recibe la nube como una interfaz chica
// (`RemoteCharacterStore`). Así se testea en Node con una nube falsa, y la
// implementación real vive en `lib/supabase/character-store.ts`.

import type { Character } from "@/rules-engine/schemas";

import {
  type EnumerableStorage,
  type KeyValueStorage,
  listLocalCharacters,
  loadCharacter,
  parseSavedCharacter,
  type SavedCharacter,
  savedCharacterSchema,
  toSavedCharacter,
  writeSavedCharacter,
} from "./character-storage";

// Lo mínimo que necesitamos de la nube. `load` devuelve lo guardado sin
// validar (`unknown`): viene de afuera y se valida con Zod acá.
export type RemoteCharacterStore = {
  load(characterId: string): Promise<unknown | null>;
  // Todos los personajes del usuario, sin validar.
  list(): Promise<unknown[]>;
  save(saved: SavedCharacter): Promise<void>;
  remove(characterId: string): Promise<void>;
};

// De dónde salió el personaje que se muestra.
// - "cloud": está guardado en la nube.
// - "local": solo en este navegador (no hay nube o falló).
export type SyncResult = {
  character: Character | null;
  where: "cloud" | "local";
};

// Al abrir la hoja: lee las dos copias, se queda con la más nueva y deja las
// dos iguales. Si la nube está vacía pero el navegador tiene algo (lo que se
// guardaba antes del ADR 0013), lo sube: así no se pierde nada.
//
// `preferRemote`: al entrar a una cuenta desde otro dispositivo (ADR 0014),
// la hoja de la cuenta gana aunque la del navegador sea más nueva. La del
// navegador era de otro usuario (el anónimo), y no debe pisar la de la cuenta.
export async function loadAndSync(
  local: KeyValueStorage,
  remote: RemoteCharacterStore | null,
  characterId: string,
  options: { preferRemote?: boolean } = {},
): Promise<SyncResult> {
  const localResult = loadCharacter(local, characterId);
  const localSaved = localResult.status === "loaded" ? localResult.saved : null;

  if (!remote)
    return { character: localSaved?.character ?? null, where: "local" };

  let remoteSaved: SavedCharacter | null;
  try {
    const raw = await remote.load(characterId);
    const parsed = raw === null ? null : parseSavedCharacter(raw, characterId);
    remoteSaved = parsed?.status === "loaded" ? parsed.saved : null;
  } catch {
    // Sin conexión o la nube falló: seguimos con la copia local.
    return { character: localSaved?.character ?? null, where: "local" };
  }

  const newest =
    options.preferRemote && remoteSaved
      ? remoteSaved
      : pickNewest(localSaved, remoteSaved);
  if (!newest) return { character: null, where: "cloud" };

  try {
    if (newest !== remoteSaved) await remote.save(newest);
  } catch {
    return { character: newest.character, where: "local" };
  }
  if (newest !== localSaved) writeSavedCharacter(local, newest);
  return { character: newest.character, where: "cloud" };
}

// La lista de "Mis personajes" (ADR 0015): junta los de la nube y los del
// navegador. Si un personaje está en los dos lados, gana la copia más nueva,
// como al abrir la hoja. Los más recientes van primero.
// Solo lee: la copia que falte en algún lado se completa al abrir la hoja.
export async function listCharacters(
  local: EnumerableStorage,
  remote: RemoteCharacterStore | null,
): Promise<{ characters: SavedCharacter[]; where: "cloud" | "local" }> {
  const byId = new Map<string, SavedCharacter>();
  for (const saved of listLocalCharacters(local)) {
    byId.set(saved.character.id, saved);
  }

  let where: "cloud" | "local" = "local";
  if (remote) {
    try {
      for (const raw of await remote.list()) {
        const parsed = savedCharacterSchema.safeParse(raw);
        if (!parsed.success) continue;
        const saved = parsed.data;
        const newest = pickNewest(byId.get(saved.character.id) ?? null, saved);
        if (newest) byId.set(saved.character.id, newest);
      }
      where = "cloud";
    } catch {
      // Sin conexión: mostramos lo que hay en este navegador.
    }
  }

  const characters = [...byId.values()].sort(
    (a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt),
  );
  return { characters, where };
}

// La copia con la fecha de guardado más reciente. Si hay empate gana la nube.
function pickNewest(
  local: SavedCharacter | null,
  remote: SavedCharacter | null,
): SavedCharacter | null {
  if (!local) return remote;
  if (!remote) return local;
  return Date.parse(local.savedAt) > Date.parse(remote.savedAt)
    ? local
    : remote;
}

// Guarda en la nube sin pisarse. Cada clic en la hoja es un cambio: si se
// mandaran todos a la vez, podrían llegar desordenados y quedaría guardado uno
// viejo. Por eso hay como mucho un pedido en camino; mientras tanto se
// recuerda solo el último (guardar o borrar), y se manda cuando termina el
// anterior.
type RemoteWrite =
  | { kind: "save"; saved: SavedCharacter }
  | { kind: "remove"; characterId: string };

export function createRemoteSaver(
  remote: RemoteCharacterStore,
  onResult: (ok: boolean) => void,
) {
  let inFlight: Promise<void> | null = null;
  let pending: RemoteWrite | null = null;

  async function flush(): Promise<void> {
    while (pending) {
      const next = pending;
      pending = null;
      try {
        if (next.kind === "save") await remote.save(next.saved);
        else await remote.remove(next.characterId);
        onResult(true);
      } catch {
        onResult(false);
      }
    }
  }

  function enqueue(write: RemoteWrite): Promise<void> {
    pending = write;
    // `finally` corre siempre después de esta línea, así que `inFlight` vuelve
    // a null recién cuando terminó todo.
    inFlight ??= flush().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  return {
    save: (character: Character, now: Date = new Date()) =>
      enqueue({ kind: "save", saved: toSavedCharacter(character, now) }),
    // "Volver al estado inicial" borra la copia de la nube.
    remove: (characterId: string) => enqueue({ kind: "remove", characterId }),
  };
}
