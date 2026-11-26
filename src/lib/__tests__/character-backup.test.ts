import { describe, expect, it } from "vitest";

import {
  BACKUP_FORMAT,
  backupFileName,
  createBackup,
  importCharacters,
  isBackupFileTooLarge,
  MAX_BACKUP_FILE_BYTES,
  mergeHomebrew,
  parseBackupFile,
} from "@/lib/character-backup";
import {
  type EnumerableStorage,
  listLocalCharacters,
  toSavedCharacter,
} from "@/lib/character-storage";
import type { RemoteCharacterStore } from "@/lib/character-sync";
import { buildHomebrewItem, emptyHomebrewItemDraft } from "@/lib/homebrew";
import { newHomebrewLibrary } from "@/lib/homebrew-storage";
import { sampleCharacter } from "@/lib/sample-character";
import type { Character } from "@/rules-engine/schemas";

function memoryStorage(): EnumerableStorage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function memoryCloud(options: { fail?: boolean } = {}) {
  const rows = new Map<string, unknown>();
  const store: RemoteCharacterStore = {
    load: async (id) => rows.get(id) ?? null,
    list: async () => [...rows.values()],
    async save(saved) {
      if (options.fail) throw new Error("offline");
      rows.set(saved.character.id, saved);
    },
    remove: async (id) => void rows.delete(id),
  };
  return { store, rows };
}

function named(id: string, name: string): Character {
  return { ...sampleCharacter, id, name };
}

const earlier = new Date("2026-11-01T10:00:00.000Z");
const later = new Date("2026-11-02T10:00:00.000Z");
const now = new Date("2026-11-26T15:30:00.000Z");

function ring(libraryId: string, itemId: string) {
  const result = buildHomebrewItem(
    {
      ...emptyHomebrewItemDraft,
      name: "Anillo de protección",
      bonuses: [{ target: "ac", value: 1 }],
    },
    libraryId,
    itemId,
  );
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.item;
}

describe("createBackup / parseBackupFile", () => {
  it("round-trips characters and homebrew", () => {
    const library = newHomebrewLibrary("abc123");
    const withRing = {
      ...library,
      items: [ring(library.package.id, "anillo-abc123")],
    };
    const saved = [toSavedCharacter(named("ana", "Ana"), earlier)];
    const text = createBackup(saved, withRing, now);

    const result = parseBackupFile(text);
    expect(result).toEqual({
      ok: true,
      backup: {
        exportedAt: now.toISOString(),
        characters: saved,
        homebrew: withRing,
      },
    });
  });

  it("works without homebrew", () => {
    const saved = [toSavedCharacter(named("ana", "Ana"), earlier)];
    const result = parseBackupFile(createBackup(saved, null, now));
    expect(result.ok && result.backup.homebrew).toBeNull();
  });

  it("names the file with the date", () => {
    expect(backupFileName(now)).toBe("gestor-dnd-copia-2026-11-26.json");
  });

  it("rejects text that is not JSON", () => {
    expect(parseBackupFile("hola")).toEqual({
      ok: false,
      error: "El archivo no es un JSON válido.",
    });
  });

  it("rejects other files, like a homebrew class", () => {
    const result = parseBackupFile(
      JSON.stringify({ format: "gestor-dnd/homebrew-class", version: 1 }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a backup with an invalid character", () => {
    const saved = toSavedCharacter(named("ana", "Ana"), earlier);
    const text = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: now.toISOString(),
      characters: [{ ...saved, character: { ...saved.character, name: "" } }],
      homebrew: null,
    });
    expect(parseBackupFile(text).ok).toBe(false);
  });

  it("rejects a backup with two characters with the same id", () => {
    const saved = toSavedCharacter(named("ana", "Ana"), earlier);
    const text = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: now.toISOString(),
      characters: [saved, saved],
      homebrew: null,
    });
    expect(parseBackupFile(text).ok).toBe(false);
  });

  // ADR 0023: el tamaño se mira antes de leer el archivo.
  it("rejects files that are too large", () => {
    expect(isBackupFileTooLarge(MAX_BACKUP_FILE_BYTES)).toBe(false);
    expect(isBackupFileTooLarge(MAX_BACKUP_FILE_BYTES + 1)).toBe(true);
    expect(parseBackupFile(" ".repeat(MAX_BACKUP_FILE_BYTES + 1)).ok).toBe(
      false,
    );
  });
});

describe("mergeHomebrew", () => {
  const library = newHomebrewLibrary("abc123");
  const a = ring(library.package.id, "anillo-a");
  const b = ring(library.package.id, "anillo-b");

  it("does nothing when the backup has no homebrew", () => {
    expect(mergeHomebrew(library, null)).toEqual({
      status: "none",
      library,
    });
  });

  it("restores the backup homebrew when the browser has none", () => {
    const incoming = { ...library, items: [a] };
    expect(mergeHomebrew(null, incoming)).toEqual({
      status: "restored",
      library: incoming,
    });
  });

  it("adds missing content of the same package and keeps the browser's copy", () => {
    const changedA = { ...a, name: "Otro nombre" };
    const current = { ...library, items: [a] };
    const incoming = { ...library, items: [changedA, b] };
    expect(mergeHomebrew(current, incoming)).toEqual({
      status: "merged",
      library: { ...library, items: [a, b] },
    });
  });

  // Los personajes apuntan al id del paquete: mezclar dos paquetes distintos
  // cambiaría ids y rompería esas referencias.
  it("keeps the browser homebrew when the packages are different", () => {
    const other = newHomebrewLibrary("zzz999");
    expect(mergeHomebrew(other, { ...library, items: [a] })).toEqual({
      status: "conflict",
      library: other,
    });
  });
});

describe("importCharacters", () => {
  it("saves new characters in the browser and the cloud", async () => {
    const local = memoryStorage();
    const cloud = memoryCloud();
    const ana = toSavedCharacter(named("ana", "Ana"), earlier);

    const result = await importCharacters(local, cloud.store, [], [ana]);

    expect(result).toEqual({ imported: 1, skipped: 0, cloudFailed: false });
    expect(listLocalCharacters(local)).toEqual([ana]);
    expect(cloud.rows.get("ana")).toEqual(ana);
  });

  it("replaces an older copy and keeps the import date", async () => {
    const local = memoryStorage();
    const old = toSavedCharacter(named("ana", "Ana vieja"), earlier);
    const fresh = toSavedCharacter(named("ana", "Ana"), later);

    const result = await importCharacters(local, null, [old], [fresh]);

    expect(result.imported).toBe(1);
    expect(listLocalCharacters(local)).toEqual([fresh]);
  });

  // Igual que al sincronizar (ADR 0013): no se pisa una copia más nueva.
  it("skips characters that are newer here", async () => {
    const local = memoryStorage();
    const cloud = memoryCloud();
    const mine = toSavedCharacter(named("ana", "Ana nueva"), later);
    const backup = toSavedCharacter(named("ana", "Ana vieja"), earlier);

    const result = await importCharacters(local, cloud.store, [mine], [backup]);

    expect(result).toEqual({ imported: 0, skipped: 1, cloudFailed: false });
    expect(listLocalCharacters(local)).toEqual([]);
    expect(cloud.rows.size).toBe(0);
  });

  // Sin conexión queda en el navegador; al abrir la hoja se sube a la nube.
  it("keeps the browser copy when the cloud fails", async () => {
    const local = memoryStorage();
    const cloud = memoryCloud({ fail: true });
    const ana = toSavedCharacter(named("ana", "Ana"), earlier);

    const result = await importCharacters(local, cloud.store, [], [ana]);

    expect(result).toEqual({ imported: 1, skipped: 0, cloudFailed: true });
    expect(listLocalCharacters(local)).toEqual([ana]);
  });
});
