import { describe, expect, it } from "vitest";

import type { KeyValueStorage } from "@/lib/character-storage";
import { buildHomebrewItem, emptyHomebrewItemDraft } from "@/lib/homebrew";
import {
  HOMEBREW_STORAGE_KEY,
  homebrewItemsFrom,
  loadHomebrew,
  newHomebrewLibrary,
  removeItem,
  saveHomebrew,
  upsertItem,
} from "@/lib/homebrew-storage";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const library = newHomebrewLibrary("abc123");

function ring(name = "Anillo de protección") {
  const result = buildHomebrewItem(
    { ...emptyHomebrewItemDraft, name, bonuses: [{ target: "ac", value: 1 }] },
    library.package.id,
    "anillo-abc123",
  );
  if (!result.ok) throw new Error(result.errors.join(" "));
  return result.item;
}

describe("homebrew storage", () => {
  it("creates a homebrew package", () => {
    expect(library.package).toMatchObject({
      id: "homebrew-abc123",
      source: "homebrew",
      edition: "2024",
    });
  });

  it("returns empty when nothing was saved", () => {
    expect(loadHomebrew(memoryStorage())).toEqual({ status: "empty" });
    expect(homebrewItemsFrom(memoryStorage())).toEqual([]);
  });

  it("loads back the items it saved", () => {
    const storage = memoryStorage();
    saveHomebrew(storage, upsertItem(library, ring()));
    const result = loadHomebrew(storage);
    expect(result.status).toBe("loaded");
    if (result.status !== "loaded") return;
    expect(result.library.items).toEqual([ring()]);
    expect(homebrewItemsFrom(storage)).toEqual([ring()]);
  });

  it("edits an item with the same id instead of duplicating it", () => {
    const edited = upsertItem(upsertItem(library, ring()), ring("Anillo +1"));
    expect(edited.items.map((i) => i.name)).toEqual(["Anillo +1"]);
  });

  it("removes an item", () => {
    expect(
      removeItem(upsertItem(library, ring()), "anillo-abc123").items,
    ).toEqual([]);
  });

  it("rejects broken JSON and items from another package", () => {
    const storage = memoryStorage();
    storage.setItem(HOMEBREW_STORAGE_KEY, "{not json");
    expect(loadHomebrew(storage)).toEqual({ status: "invalid" });

    const stolen = { ...ring(), packageId: "srd-2024" };
    storage.setItem(
      HOMEBREW_STORAGE_KEY,
      JSON.stringify({ version: 1, package: library.package, items: [stolen] }),
    );
    expect(loadHomebrew(storage)).toEqual({ status: "invalid" });
  });

  it("rejects a package that is not homebrew", () => {
    const storage = memoryStorage();
    storage.setItem(
      HOMEBREW_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        package: { ...library.package, source: "srd" },
        items: [],
      }),
    );
    expect(loadHomebrew(storage)).toEqual({ status: "invalid" });
  });
});
