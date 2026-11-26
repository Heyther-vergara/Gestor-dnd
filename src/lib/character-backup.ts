// Copia de seguridad en un archivo JSON (ADR 0026).
//
// Con el usuario anónimo (ADR 0013) los personajes quedan atados a un
// navegador: si se borran sus datos o se cambia de dispositivo, se pierde el
// acceso. Esta copia los saca de ahí: se descarga un archivo con todos los
// personajes y el homebrew, y se vuelve a importar donde haga falta.
//
// Como `character-sync`, no importa Supabase: recibe la nube como interfaz.

import { z } from "zod";

import { LIMITS } from "@/rules-engine/schemas/limits";

import {
  type KeyValueStorage,
  type SavedCharacter,
  savedCharacterSchema,
  writeSavedCharacter,
} from "./character-storage";
import type { RemoteCharacterStore } from "./character-sync";
import {
  type HomebrewLibrary,
  parseHomebrewLibrary,
  toStoredHomebrew,
} from "./homebrew-storage";

export const BACKUP_FORMAT = "gestor-dnd/backup";

// Tamaño máximo del archivo (ADR 0023). En la base cada personaje puede pesar
// hasta 256 KB, pero uno normal pesa 2 o 3 KB: 5 MB alcanza para cientos.
// Se mira antes de leer el archivo, para no congelar la pestaña.
export const MAX_BACKUP_FILE_BYTES = 5_000_000;

export const backupFileTooLargeError = `El archivo es demasiado grande (máximo ${MAX_BACKUP_FILE_BYTES / 1_000_000} MB).`;

export function isBackupFileTooLarge(bytes: number): boolean {
  return bytes > MAX_BACKUP_FILE_BYTES;
}

// El archivo: un sobre con formato y versión (para poder migrarlo si cambia),
// los personajes con el mismo formato que en el navegador y la base, y el
// homebrew con el formato de localStorage. Ambos se validan con los mismos
// esquemas que ya usa la app: un archivo es un dato de afuera como cualquier
// otro.
const backupFileSchema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: z.iso.datetime(),
  characters: z
    .array(savedCharacterSchema)
    .max(LIMITS.list)
    .refine(
      (list) => new Set(list.map((s) => s.character.id)).size === list.length,
      { message: "Hay personajes repetidos" },
    ),
  homebrew: z.unknown().nullable(),
});

export type Backup = {
  exportedAt: string;
  characters: SavedCharacter[];
  homebrew: HomebrewLibrary | null;
};

export function createBackup(
  characters: SavedCharacter[],
  homebrew: HomebrewLibrary | null,
  now: Date = new Date(),
): string {
  const file: z.input<typeof backupFileSchema> = {
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    characters,
    homebrew: homebrew ? toStoredHomebrew(homebrew) : null,
  };
  // Con sangría: así se puede abrir y leer en cualquier editor.
  return JSON.stringify(file, null, 2);
}

// "gestor-dnd-copia-2026-11-26.json"
export function backupFileName(now: Date = new Date()): string {
  return `gestor-dnd-copia-${now.toISOString().slice(0, 10)}.json`;
}

export type ParseBackupResult =
  { ok: true; backup: Backup } | { ok: false; error: string };

export function parseBackupFile(text: string): ParseBackupResult {
  // Defensa en profundidad: quien llama ya debería haber mirado `file.size`.
  if (isBackupFileTooLarge(text.length)) {
    return { ok: false, error: backupFileTooLargeError };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "El archivo no es un JSON válido." };
  }
  const parsed = backupFileSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        "El archivo no es una copia del gestor o tiene datos que no son válidos.",
    };
  }
  let homebrew: HomebrewLibrary | null = null;
  if (parsed.data.homebrew !== null) {
    homebrew = parseHomebrewLibrary(parsed.data.homebrew);
    if (!homebrew) {
      return { ok: false, error: "El homebrew de la copia no es válido." };
    }
  }
  return {
    ok: true,
    backup: {
      exportedAt: parsed.data.exportedAt,
      characters: parsed.data.characters,
      homebrew,
    },
  };
}

// Qué pasó con el homebrew de la copia:
// - "none": la copia no traía homebrew.
// - "restored": este navegador no tenía, se usa el de la copia tal cual.
// - "merged": es el mismo paquete; se agregó lo que faltaba.
// - "conflict": este navegador ya tiene otro paquete. No se mezclan, porque
//   los personajes apuntan al id del paquete y cambiarlo rompería esas
//   referencias. Se deja el de este navegador.
export type MergeHomebrewResult = {
  status: "none" | "restored" | "merged" | "conflict";
  library: HomebrewLibrary | null;
};

export function mergeHomebrew(
  current: HomebrewLibrary | null,
  incoming: HomebrewLibrary | null,
): MergeHomebrewResult {
  if (!incoming) return { status: "none", library: current };
  if (!current) return { status: "restored", library: incoming };
  if (current.package.id !== incoming.package.id) {
    return { status: "conflict", library: current };
  }
  // Mismo paquete: se agrega lo que no está. Si un objeto está en los dos
  // lados gana el de este navegador, que puede haberse editado después.
  const addMissing = <T extends { id: string }>(mine: T[], theirs: T[]) => {
    const ids = new Set(mine.map((c) => c.id));
    return [...mine, ...theirs.filter((c) => !ids.has(c.id))];
  };
  return {
    status: "merged",
    library: {
      ...current,
      items: addMissing(current.items, incoming.items),
      classes: addMissing(current.classes, incoming.classes),
    },
  };
}

export type ImportResult = {
  imported: number;
  // Ya había una copia igual o más nueva: no se pisó.
  skipped: number;
  // La nube falló: lo importado quedó en el navegador y se sube al abrir la
  // hoja (ADR 0013).
  cloudFailed: boolean;
};

// Guarda los personajes de la copia. `existing` son los que ya se ven en
// "Mis personajes" (nube + navegador). Con la misma regla que al sincronizar,
// gana la copia más nueva: importar un archivo viejo no pisa lo que jugaste
// después. Se guarda con su fecha original, sin cambiarla.
export async function importCharacters(
  local: KeyValueStorage,
  remote: RemoteCharacterStore | null,
  existing: SavedCharacter[],
  incoming: SavedCharacter[],
): Promise<ImportResult> {
  const byId = new Map(existing.map((s) => [s.character.id, s]));
  const result: ImportResult = { imported: 0, skipped: 0, cloudFailed: false };

  for (const saved of incoming) {
    const current = byId.get(saved.character.id);
    if (current && Date.parse(current.savedAt) >= Date.parse(saved.savedAt)) {
      result.skipped++;
      continue;
    }
    writeSavedCharacter(local, saved);
    result.imported++;
    if (remote && !result.cloudFailed) {
      try {
        await remote.save(saved);
      } catch {
        // Sin conexión: no seguimos intentando con los demás.
        result.cloudFailed = true;
      }
    }
  }
  return result;
}
