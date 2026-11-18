import { describe, expect, it } from "vitest";

import { sampleCharacter } from "@/lib/sample-character";
import {
  createSavedSheetReducer,
  initialSavedSheetState,
} from "@/lib/saved-sheet-reducer";
import { srd2024Index } from "@/lib/srd-2024";
import { buildHomebrewItem, emptyHomebrewItemDraft } from "@/lib/homebrew";

const reducer = createSavedSheetReducer(srd2024Index);
const start = initialSavedSheetState(sampleCharacter);

describe("saved sheet reducer", () => {
  it("starts loading, with the initial character", () => {
    expect(start.saveStatus).toBe("loading");
    expect(start.session.character).toBe(sampleCharacter);
  });

  it("replaces the character with the saved one when loading finishes", () => {
    const saved = {
      ...sampleCharacter,
      playState: { ...sampleCharacter.playState, damageTaken: 25 },
    };
    const next = reducer(start, {
      type: "storage-loaded",
      character: saved,
      where: "cloud",
    });
    expect(next.saveStatus).toBe("cloud");
    expect(next.session.character).toBe(saved);
  });

  it("keeps the initial character when nothing was saved", () => {
    const next = reducer(start, {
      type: "storage-loaded",
      character: null,
      where: "local",
    });
    expect(next.saveStatus).toBe("local");
    expect(next.session.character).toBe(sampleCharacter);
  });

  it("marks storage as unavailable without touching the character", () => {
    const next = reducer(start, { type: "storage-failed" });
    expect(next.saveStatus).toBe("unavailable");
    expect(next.session).toBe(start.session);
  });

  it("passes play actions to the play reducer and keeps the save status", () => {
    const loaded = reducer(start, {
      type: "storage-loaded",
      character: null,
      where: "local",
    });
    const next = reducer(loaded, { type: "damage", amount: 5 });
    expect(next.saveStatus).toBe("local");
    expect(next.session.character.playState.damageTaken).toBe(
      sampleCharacter.playState.damageTaken + 5,
    );
  });

  it("tracks cloud saves after loading", () => {
    const loaded = reducer(start, {
      type: "storage-loaded",
      character: null,
      where: "cloud",
    });
    const failed = reducer(loaded, { type: "cloud-result", ok: false });
    expect(failed.saveStatus).toBe("cloud-error");
    expect(reducer(failed, { type: "cloud-result", ok: true }).saveStatus).toBe(
      "cloud",
    );
    // Repetir el mismo resultado devuelve el mismo estado (no hay re-render).
    expect(reducer(failed, { type: "cloud-result", ok: false })).toBe(failed);
  });

  it("ignores cloud results while still loading", () => {
    expect(reducer(start, { type: "cloud-result", ok: true })).toBe(start);
  });

  // Al entrar o salir de la cuenta se vuelve a leer lo guardado: mientras
  // tanto no se guarda nada, para no pisar la hoja de la otra cuenta.
  it("goes back to loading with the given character on reload", () => {
    const loaded = reducer(start, {
      type: "storage-loaded",
      character: null,
      where: "cloud",
    });
    const hurt = reducer(loaded, { type: "damage", amount: 5 });
    const next = reducer(hurt, { type: "reload", character: sampleCharacter });
    expect(next.saveStatus).toBe("loading");
    expect(next.session.character).toBe(sampleCharacter);
  });

  it("gives and takes a homebrew item, keeping the same state if nothing changes", () => {
    const built = buildHomebrewItem(
      {
        ...emptyHomebrewItemDraft,
        name: "Anillo",
        bonuses: [{ target: "ac", value: 1 }],
      },
      "homebrew-test",
      "anillo-test",
    );
    if (!built.ok) throw new Error("item");
    const loaded = reducer(start, {
      type: "storage-loaded",
      character: null,
      where: "local",
    });
    const given = reducer(loaded, { type: "give-item", item: built.item });
    expect(given.session.character.inventory.at(-1)?.itemId).toBe(
      "anillo-test",
    );
    expect(given.saveStatus).toBe("local");
    expect(reducer(given, { type: "give-item", item: built.item })).toBe(given);

    const taken = reducer(given, { type: "take-item", itemId: "anillo-test" });
    expect(taken.session.character.inventory).toEqual(
      sampleCharacter.inventory,
    );
    expect(reducer(taken, { type: "take-item", itemId: "anillo-test" })).toBe(
      taken,
    );
  });

  // ADR 0021: preparar un conjuro cambia el personaje y se guarda.
  it("prepares a spell, keeping the same state if it is not allowed", () => {
    const wizard = {
      ...sampleCharacter,
      classes: [
        {
          classId: "wizard",
          level: 1,
          spellbookIds: ["sleep", "shield"],
          preparedSpellIds: [],
        },
      ],
    };
    const loaded = reducer(initialSavedSheetState(wizard), {
      type: "storage-loaded",
      character: null,
      where: "local",
    });
    const toggle = (spellId: string) =>
      ({
        type: "toggle-spell",
        classId: "wizard",
        kind: "preparedSpellIds",
        spellId,
      }) as const;
    const prepared = reducer(loaded, toggle("sleep"));
    expect(prepared.session.character.classes[0]?.preparedSpellIds).toEqual([
      "sleep",
    ]);
    // "Fireball" no está en el libro.
    expect(reducer(prepared, toggle("fireball"))).toBe(prepared);
  });
});
