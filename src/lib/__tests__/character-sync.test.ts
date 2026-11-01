import { describe, expect, it } from "vitest";

import {
  characterStorageKey,
  type KeyValueStorage,
  type SavedCharacter,
  saveCharacter,
  toSavedCharacter,
} from "@/lib/character-storage";
import {
  createRemoteSaver,
  loadAndSync,
  type RemoteCharacterStore,
} from "@/lib/character-sync";
import { sampleCharacter } from "@/lib/sample-character";
import type { Character } from "@/rules-engine/schemas";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

// Nube falsa en memoria. `fail` simula estar sin conexión.
function memoryCloud(options: { fail?: boolean } = {}) {
  const rows = new Map<string, unknown>();
  const calls: string[] = [];
  const store: RemoteCharacterStore = {
    async load(id) {
      calls.push(`load:${id}`);
      if (options.fail) throw new Error("offline");
      return rows.get(id) ?? null;
    },
    async save(saved) {
      calls.push(`save:${saved.character.playState.damageTaken}`);
      if (options.fail) throw new Error("offline");
      rows.set(saved.character.id, saved);
    },
    async remove(id) {
      calls.push(`remove:${id}`);
      if (options.fail) throw new Error("offline");
      rows.delete(id);
    },
  };
  return { store, rows, calls };
}

function hurt(damageTaken: number): Character {
  return {
    ...sampleCharacter,
    playState: { ...sampleCharacter.playState, damageTaken },
  };
}

const id = sampleCharacter.id;
const earlier = new Date("2026-11-01T10:00:00.000Z");
const later = new Date("2026-11-01T11:00:00.000Z");

describe("loadAndSync", () => {
  it("uses only the browser when there is no cloud", async () => {
    const local = memoryStorage();
    saveCharacter(local, hurt(4));
    expect(await loadAndSync(local, null, id)).toEqual({
      character: hurt(4),
      where: "local",
    });
  });

  // Compatibilidad con lo que se guardaba antes (ADR 0011): no se pierde.
  it("uploads a browser save when the cloud is empty", async () => {
    const local = memoryStorage();
    saveCharacter(local, hurt(7), earlier);
    const cloud = memoryCloud();

    const result = await loadAndSync(local, cloud.store, id);

    expect(result).toEqual({ character: hurt(7), where: "cloud" });
    expect(cloud.rows.get(id)).toEqual(toSavedCharacter(hurt(7), earlier));
  });

  it("brings a cloud save into the browser copy", async () => {
    const local = memoryStorage();
    const cloud = memoryCloud();
    cloud.rows.set(id, toSavedCharacter(hurt(9), earlier));

    const result = await loadAndSync(local, cloud.store, id);

    expect(result).toEqual({ character: hurt(9), where: "cloud" });
    expect(JSON.parse(local.data.get(characterStorageKey(id))!)).toEqual(
      toSavedCharacter(hurt(9), earlier),
    );
  });

  it("keeps the newest copy when both exist", async () => {
    const local = memoryStorage();
    saveCharacter(local, hurt(2), later);
    const cloud = memoryCloud();
    cloud.rows.set(id, toSavedCharacter(hurt(1), earlier));

    const result = await loadAndSync(local, cloud.store, id);

    expect(result.character).toEqual(hurt(2));
    expect((cloud.rows.get(id) as SavedCharacter).character).toEqual(hurt(2));
  });

  it("ignores a cloud row that does not pass the schema", async () => {
    const local = memoryStorage();
    const cloud = memoryCloud();
    cloud.rows.set(id, { version: 1, character: { id } });

    expect(await loadAndSync(local, cloud.store, id)).toEqual({
      character: null,
      where: "cloud",
    });
  });

  it("falls back to the browser when the cloud is offline", async () => {
    const local = memoryStorage();
    saveCharacter(local, hurt(3));
    const cloud = memoryCloud({ fail: true });

    expect(await loadAndSync(local, cloud.store, id)).toEqual({
      character: hurt(3),
      where: "local",
    });
  });
});

describe("createRemoteSaver", () => {
  it("sends only the latest change while another save is on its way", async () => {
    const cloud = memoryCloud();
    const results: boolean[] = [];
    const saver = createRemoteSaver(cloud.store, (ok) => results.push(ok));

    // Tres clics seguidos: el primero sale, el segundo se reemplaza por el tercero.
    const first = saver.save(hurt(1));
    void saver.save(hurt(2));
    void saver.save(hurt(3));
    await first;

    expect(cloud.calls).toEqual(["save:1", "save:3"]);
    expect((cloud.rows.get(id) as SavedCharacter).character).toEqual(hurt(3));
    expect(results).toEqual([true, true]);
  });

  it("a reset after a pending save leaves the cloud empty", async () => {
    const cloud = memoryCloud();
    const saver = createRemoteSaver(cloud.store, () => {});

    const first = saver.save(hurt(1));
    void saver.save(hurt(2));
    void saver.remove(id);
    await first;

    expect(cloud.calls).toEqual(["save:1", `remove:${id}`]);
    expect(cloud.rows.has(id)).toBe(false);
  });

  it("reports a failed save and keeps working afterwards", async () => {
    const results: boolean[] = [];
    const offline = memoryCloud({ fail: true });
    const saver = createRemoteSaver(offline.store, (ok) => results.push(ok));

    await saver.save(hurt(1));
    await saver.save(hurt(2));

    expect(results).toEqual([false, false]);
    expect(offline.calls).toEqual(["save:1", "save:2"]);
  });
});
