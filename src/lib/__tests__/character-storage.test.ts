import { describe, expect, it } from "vitest";

import {
  characterStorageKey,
  clearCharacter,
  type KeyValueStorage,
  loadCharacter,
  saveCharacter,
} from "@/lib/character-storage";
import { sampleCharacter } from "@/lib/sample-character";

// Almacenamiento falso en memoria, con la misma interfaz que localStorage.
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const key = characterStorageKey(sampleCharacter.id);

describe("character storage", () => {
  it("returns empty when nothing was saved", () => {
    expect(loadCharacter(memoryStorage(), sampleCharacter.id)).toEqual({
      status: "empty",
    });
  });

  it("loads back the same character and play state it saved", () => {
    const storage = memoryStorage();
    const hurt = {
      ...sampleCharacter,
      playState: {
        ...sampleCharacter.playState,
        damageTaken: 20,
        tempHp: 3,
        hitDiceSpent: { d10: 1 },
        deathSaves: { successes: 1, failures: 2 },
      },
    };
    const now = new Date("2026-10-30T12:00:00.000Z");

    saveCharacter(storage, hurt, now);
    const result = loadCharacter(storage, sampleCharacter.id);

    expect(result).toEqual({
      status: "loaded",
      saved: { version: 1, savedAt: now.toISOString(), character: hurt },
    });
  });

  it("ignores data that is not JSON", () => {
    const storage = memoryStorage();
    storage.setItem(key, "{roto");
    expect(loadCharacter(storage, sampleCharacter.id).status).toBe("invalid");
  });

  it("ignores a character that no longer passes the schema", () => {
    const storage = memoryStorage();
    saveCharacter(storage, sampleCharacter);
    const saved = JSON.parse(storage.data.get(key)!);
    saved.character.playState.damageTaken = -5;
    storage.setItem(key, JSON.stringify(saved));

    expect(loadCharacter(storage, sampleCharacter.id).status).toBe("invalid");
  });

  // ADR 0012: los campos nuevos de playState tienen valor por defecto, así
  // que lo guardado antes de que existieran se sigue pudiendo cargar.
  it("loads a save from before max HP reduction existed", () => {
    const storage = memoryStorage();
    saveCharacter(storage, sampleCharacter);
    const saved = JSON.parse(storage.data.get(key)!);
    delete saved.character.playState.maxHpReduction;
    storage.setItem(key, JSON.stringify(saved));

    const result = loadCharacter(storage, sampleCharacter.id);
    if (result.status !== "loaded") throw new Error(result.status);
    expect(result.saved.character.playState.maxHpReduction).toBe(0);
  });

  it("ignores a save from an unknown format version", () => {
    const storage = memoryStorage();
    saveCharacter(storage, sampleCharacter);
    const saved = JSON.parse(storage.data.get(key)!);
    storage.setItem(key, JSON.stringify({ ...saved, version: 99 }));

    expect(loadCharacter(storage, sampleCharacter.id).status).toBe("invalid");
  });

  it("ignores a save whose character has another id", () => {
    const storage = memoryStorage();
    saveCharacter(storage, { ...sampleCharacter, id: "otro" });
    storage.setItem(key, storage.data.get(characterStorageKey("otro"))!);

    expect(loadCharacter(storage, sampleCharacter.id).status).toBe("invalid");
  });

  it("clears the saved character", () => {
    const storage = memoryStorage();
    saveCharacter(storage, sampleCharacter);
    clearCharacter(storage, sampleCharacter.id);
    expect(loadCharacter(storage, sampleCharacter.id).status).toBe("empty");
  });
});
